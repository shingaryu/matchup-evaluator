require('dotenv').config();

global.program = require('commander');
global.program
.option('--csv [file]', "file path of a csv file including all pokemon species info. ['./species.csv']", './species.csv')
.parse(process.argv);

const fs = require('fs');
const { sqlService } = require('./sql-service');

// currently these pokemon are not handled correctly. do it manually
const exclusionNameList = [
  'Farfetch’d',
  'Farfetch’d-Galar',
  'Flabébé',
  'Sirfetch’d'
]

fs.readFile(global.program.csv, 'utf8', (err, data) => {
  if (err) throw err;

  const lines = data.split('\n');
  if (lines.length === 0) {
    throw new Error('Error: no input record found!')
  }

  const promises = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      continue;
    }
  
    const fields = line.split(',');
    if (fields.length !== 2) {
      throw new Error('Error: malformed record of input!');
    }
  
    const dexNum = fields[0];
    const name = fields[1];
  
    console.log(`dexnum: ${dexNum}, name: ${name}`);
    if (exclusionNameList.indexOf(name) >= 0) {
      console.log(`warn: pokemon ${name} is not handled in this program. please remind that there is no DB update about this pokemon`);
      continue;
    }

    promises.push(sqlService.insertPokemonSpeciesIfNotExists(dexNum, name));
  }

  Promise.all(promises).then(
    value => {
      sqlService.endConnection();
      console.log(`finished inserting all new species!`);
    },
    error => {
      console.log(error);
      sqlService.endConnection();
    }    
  )

  console.log('waiting for DB updates...')
});
