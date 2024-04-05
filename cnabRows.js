'use strict';
import path from 'path'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url';

import yargs from 'yargs'
import chalk from 'chalk'
import { writeFile } from 'fs';

const optionsYargs = yargs(process.argv.slice(2))
  .usage('Uso: $0 [options]')
  .option("f", { alias: "from", describe: "posição inicial de pesquisa da linha do Cnab", type: "number", demandOption: true })
  .option("t", { alias: "to", describe: "posição final de pesquisa da linha do Cnab", type: "number", demandOption: true })
  .option("s", { alias: "segmento", describe: "tipo de segmento", type: "string", demandOption: true })
  .option("e", { alias: "searchSegment", describe: "Pesquisar segmento especifico", type: "string"})
  .option("p", { alias: "path", describe: "caminho do arquivo Cnab", type: "string"})
  .option("n", { alias: "name", describe: "Nome da empresa a ser pesquisado", type: "string"})
  .option("j", { alias: "json", describe: "Exportar informações para Json", type: "boolean"})
  .example('$0 -f 21 -t 34 -s p', 'Lista a linha e campo que from e to do cnab.')
  .example('$0 -f 21 -t 34 -s q -p arquivo.rem', 'Lista a linha e campo que from e to do cnab do arquivo escolhido.\n')
  .example('$0 -f 21 -t 34 -s p -e "00000000000000"', 'Exibe registro ligado ao segmento especifico.\n')
  .example('$0 -f 21 -t 34 -s q -n "BRASIL"', 'Exibe registro(s) ligado a nome pesquisados\n')
  .example('$0 -f 21 -t 34 -s q -n "BRASIL" -j true', 'Lista a linha e campo que from e to do cnab\n')
  .argv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let file; 
if (optionsYargs.path) {
  file = optionsYargs.path;
} else {
  file = path.resolve(`${__dirname}/cnabExample.rem`)
  console.log ("Nenhum arquivo Cnab especificado. utilizado arquivo padrão: cnabExample.rem")
}


const { from, to, segmento, searchSegment, name, json} = optionsYargs

function messageLog (segmento, segmentoType, from, to, nameCompany) {
  let output;
 
 if (!nameCompany){
  output = ''
 }else {
  output = `Empresa associada: ${nameCompany.name}\n`
   if (nameCompany.positions){
    output += `Encontrada na posição: ${nameCompany.positions}`
   }
 }

  return  `
  ----- Cnab linha ${segmento.substring(13,14).toUpperCase()} -----
  
  posição from: ${chalk.inverse.bgBlack(from)}
  
  posição to: ${chalk.inverse.bgBlack(to)}
  
  item isolado: ${chalk.inverse.bgBlack(segmento.substring(from - 1, to))}
  
  item dentro da linha ${segmentoType}: 
    ${segmento.substring(0, from)}${chalk.inverse.bgBlack(segmento.substring(from - 1, to))}${segmento.substring(to)}
  
  ${output}
  
  ----- FIM ------
  `
} 

const log = console.log

console.time('leitura Async')

readFile(file, 'utf8')
  .then(fileContent => {
    const cnabArray = fileContent.split('\n')

    const companyNamePosition = (cnabSegment, nameCompany) => cnabSegment.indexOf(nameCompany) + 1;

    function extractFullNameCompanies(cnabSegment) {
      if (cnabSegment.substring(13, 14) == 'Q'){
        return cnabSegment.substring(33, 73).trim();
      } 
      return `O segmento não possui empresa associada no documento.`
    }

    function findBySegment(segmento, from, to, searchSegment) {
      let segment;
      cnabArray.forEach(specificSegment => {
        if (specificSegment.substring(0, 14).includes(searchSegment)) {
          segment = specificSegment
          return 
        }
      })

      if (segment) {
        let nameCompany = extractFullNameCompanies(segment)
        let result = {
          name: nameCompany
        }
        if (json){
          exportTojson(segmento, segment)
        }
        return log(messageLog(segment, segmento.toUpperCase(), from, to, result))
      } else {
          return log("Segmento especificado não encontrado")
      }

      
    }

    function findByNameCompany(segmento, from, to, name) {
      let result = {  }
      if (segmento.toLowerCase() == 'q') {
        cnabArray.forEach(nameCompanies => {
          if (nameCompanies.substring(33, 73).toLowerCase().includes(name.toLowerCase())) {
            result.company = nameCompanies
            result.segment = segmento
            result.positions = companyNamePosition(cnabArray, nameCompanies) * 240 + 33
            result.name = extractFullNameCompanies(nameCompanies)
            log(messageLog(nameCompanies, segmento.toUpperCase(), from, to, result))
          } 
          
        }) 
        if (json){
          exportTojson(segmento, result.company)
        }
      } else {
        log(`O segmento ${segmento.toUpperCase()} não possui informaçãos das empresas associadas no documento.`)
      }
    
    }

    async function exportTojson(segmento, cnabSegment) {
      if (segmento.toLowerCase() == 'q') {
        const jsonExport = {
          Segmento: cnabSegment.substring(0, 13).trim(),
          Tipo_Segmento: cnabSegment.substring(13, 14).trim(),
          Nome_Empresa: cnabSegment.substring(33, 73).trim(),
          Logradouro: cnabSegment.substring(73, 113).trim(),
          Bairro: cnabSegment.substring(113, 128).trim(),
          Cep: cnabSegment.substring(128, 136).trim(),
          Cidade : cnabSegment.substring(136, 151).trim(),
          UF: cnabSegment.substring(151, 153).trim()
        }
        writeFile('result.json', JSON.stringify(jsonExport), (error) => {
          if (error) {
            log(error)
            return
          }
        })
      }
       
    }  

    function checkArguments(segmento, from, to, searchSegment, name){
      if (name && searchSegment) {
         return log("Use apenas um parâmetro opcional para a busca.")
      }
      if (searchSegment){
        findBySegment(segmento, from, to, searchSegment)
      } 
      if (name) {
        findByNameCompany(segmento, from, to, name)
      }
      if (!name && !searchSegment) {
        const filteredRecords = cnabArray.filter(record => {
          const recordSubstring = record.substring(from -1, to)
          return recordSubstring.trim() !== ''
        })

        if (filteredRecords.length > 0 ) {
          log(messageLog(filteredRecords[0], segmento.toUpperCase(), from, to, name))
        }
  
      }
      
    }

    switch (segmento.toLowerCase()) {
      case 'p':
        checkArguments(segmento, from, to, searchSegment, name)
        break;
      case 'r':
        checkArguments(segmento, from, to, searchSegment, name)
        break;
      case 'q':
        checkArguments(segmento, from, to, searchSegment, name)
        break;
      default:
        log("Segmento inválido!")
        break;
    }

  })
  .catch(error => {
    log("Ocorreu um erro durante o processamento do arquivo:", error.message)
  })
console.timeEnd('leitura Async')




