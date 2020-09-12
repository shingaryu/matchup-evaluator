// Command-line Arguments
global.program = require('commander');
global.program
.option('--net [action]', "'create' - generate a new network. 'update' - use and modify existing network. 'use' - use, but don't modify network. 'none' - use hardcoded weights. ['none']", 'none')
.option('-d --depth [depth]', "Minimax bot searches to this depth in the matchup evaluation. [2]", "2")
.option('--nolog', "Don't append to log files.")
.option('--onlyinfo [onlyinfo]', "Hide debug messages and speed up bot calculations", true)
.option('--usechildprocess', "Use child process to execute heavy calculations with parent process keeping the connection to showdown server.")
.option('-n, --numoftrials [numoftrials]', "Each matchup evaluation is iterated and averaged by the number of trials. [10]", "10")
.parse(process.argv);

const { Dex, PcmBattle, Minimax, initLog4js, Util } = require('percymon');
const moment = require('moment');
// const SqlService = require('./sql-service').SqlService;
const getPokemonStrategies = require('./pokemonStrategiesApi').getPokemonStrategies;
const validatePokemonSets = require('./team-validate-service').validatePokemonSets;
const math = require('mathjs');

// Setup Logging
initLog4js(global.program.nolog, global.program.onlyinfo);
const logger = require('log4js').getLogger("bot");

calcDamageArray();

async function calcDamageArray () {
  const startTime = new Date();

  const strategies = await getPokemonStrategies();
  const myPoke = createPokemonSetFromStrategy(strategies.data[3]);
  const oppPoke = createPokemonSetFromStrategy(strategies.data[7]);

  const customGameFormat = createCustomGameFormat();
  validatePokemonSets(customGameFormat, [myPoke, oppPoke]);
     
  logger.info(`evaluate about ${myPoke.species} vs ${oppPoke.species}`);

  const p1 = { name: 'botPlayer', avatar: 1, team: [myPoke] };
  const p2 = { name: 'humanPlayer', avatar: 1, team: [oppPoke] };								
  const battleOptions = { format: customGameFormat, rated: false, send: null, p1, p2 };
  const battle = new PcmBattle(battleOptions);
  battle.start();              
  battle.makeRequest();                   
  const choicesP1 = Util.parseRequest(battle.p1.request).choices;
  const choicesP2 = Util.parseRequest(battle.p2.request).choices;

  const filtChoicesP1 = choicesP1.filter(choice => choice.type == "move" && !choice.runDynamax); 
  const filtChoicesP2 = choicesP2.filter(choice => choice.type == "move" && !choice.runDynamax); 
  // calcTwoToTwoDamageArray(myPoke, oppPoke, [filtChoicesP1[0], filtChoicesP1[1]], [filtChoicesP2[0], filtChoicesP2[1]], customGameFormat);
  const result = calcFourToFourDamageMatrix(myPoke, oppPoke, filtChoicesP1, filtChoicesP2, customGameFormat);
  const x = calcAveragedDamageArray(result.matrix, result.vector, [0, 1, 2, 3], [0, 1, 2]);

  for (let i = 0; i < 8; i += 2) {
    const move = filtChoicesP1[i / 2];
    const PlayerDamageDiff = x[i];
    const oppDamageDiff = x[i + 1];
    console.log(`move: ${move.id}, player HP: ${PlayerDamageDiff}, opp HP: ${oppDamageDiff}`);   
  }

  console.log();

  for (let i = 8; i < 16; i += 2) {
    const move = filtChoicesP2[(i - 8) / 2];
    const PlayerDamageDiff = x[i];
    const oppDamageDiff = x[i + 1];
    console.log(`move: ${move.id}, player HP: ${PlayerDamageDiff}, opp HP: ${oppDamageDiff}`);   
  }


  // battle.choose('p1', Util.toChoiceString(choicesP1[0], battle.p1), battle.rqid);
  // battle.choose('p2', Util.toChoiceString(choicesP2[0], battle.p2), battle.rqid);
  // logger.trace("Player action: " + Util.toChoiceString(choicesP1[0] || '(wait)', battle.p1));
  // logger.trace("Opponent action: " + Util.toChoiceString(choicesP2[0], battle.p2));
  // logger.trace("My Resulting Health:");
  // for(let k = 0; k < battle.p1.pokemon.length; k++) {
  //     logger.trace(battle.p1.pokemon[k].species.name + ": " + battle.p1.pokemon[k].hp + "/" + battle.p1.pokemon[k].maxhp);
  // }
  // logger.trace("Opponent's Resulting Health:");
  // for(let k = 0; k < battle.p2.pokemon.length; k++) {
  //     logger.trace(battle.p2.pokemon[k].species.name + ": " + battle.p2.pokemon[k].hp + "/" + battle.p2.pokemon[k].maxhp);
  // }

   const endTime = new Date();
   const duration = moment.duration(endTime - startTime);
   logger.info('Finished all calculations!');
   logger.info(`Elapsed time: ${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`);
}

function calcAveragedDamageArray(matrix, vector, myStandardMoveIndices, oppStandardMoveIndices) {
  const indices = [];
  myStandardMoveIndices.forEach(x => indices.push({i: x, isMyChoice: true}));
  oppStandardMoveIndices.forEach(x => indices.push({i: x, isMyChoice: false}));

  const ind = Math.floor(math.random(0, indices.length));
  const firstMove = indices[ind];
  const newIndices = indices.filter((x, i) => i !== ind);
  const secondInd = Math.floor(math.random(0, newIndices.length));
  const secondMove = newIndices[secondInd];

  const solutionVector1 = [];
  for (let k = 0; k < 16; k++) {
    if (firstMove.isMyChoice && k === 2 * firstMove.i) {
      solutionVector1.push(1);
    } else if (!firstMove.isMyChoice && k === 2 * firstMove.i + 8 + 1) {
      solutionVector1.push(1);
    } else {
      solutionVector1.push(0);
    }
  }
  matrix.push(solutionVector1);
  vector.push(0);

  const solutionVector2 = [];
  for (let k = 0; k < 16; k++) {
    if (secondMove.isMyChoice && k === 2 * secondMove.i) {
      solutionVector2.push(1);
    } else if (!secondMove.isMyChoice && k === 2 * secondMove.i + 8 + 1) {
      solutionVector2.push(1);
    } else {
      solutionVector2.push(0);
    }
  }
  matrix.push(solutionVector2);
  vector.push(0);

  const inverse = math.inv(matrix);
  const x = math.multiply(inverse, vector);

  console.log(x);

  return x;
}

function calcFourToFourDamageMatrix(myPoke, oppPoke, myChoices, oppChoices, gameFormat) {
  const damageMatrix = []; // 14 x 16
  const damageVector = []; // 14
  const zeros = [];
  for (let i = 0; i < 16; i++) {
    zeros.push(0);
  }

  logger.info(`evaluate about ${myPoke.species} vs ${oppPoke.species}`);
  for (let i = 0; i < myChoices.length; i++) {
    const myChoice = myChoices[i];
    for (let j = 0; j < oppChoices.length; j++) {
      if (i >= 1 && j >= 1) {
        continue;
      }

      const oppChoice = oppChoices[j];
      
      const p1 = { name: 'botPlayer', avatar: 1, team: [myPoke] };
      const p2 = { name: 'humanPlayer', avatar: 1, team: [oppPoke] };								
      const battleOptions = { format: gameFormat, rated: false, send: null, p1, p2 };
      const battle = new PcmBattle(battleOptions);
      battle.start();              
      battle.makeRequest();                   
      
      battle.choose('p1', Util.toChoiceString(myChoice, battle.p1), battle.rqid);
      battle.choose('p2', Util.toChoiceString(oppChoice, battle.p2), battle.rqid);
      logger.trace("Player action: " + Util.toChoiceString(myChoice, battle.p1));
      logger.trace("Opponent action: " + Util.toChoiceString(oppChoice, battle.p2));
      logger.trace("My Resulting Health:");
      for(let k = 0; k < battle.p1.pokemon.length; k++) {
          logger.trace(battle.p1.pokemon[k].species.name + ": " + battle.p1.pokemon[k].hp + "/" + battle.p1.pokemon[k].maxhp);
      }
      logger.trace("Opponent's Resulting Health:");
      for(let k = 0; k < battle.p2.pokemon.length; k++) {
          logger.trace(battle.p2.pokemon[k].species.name + ": " + battle.p2.pokemon[k].hp + "/" + battle.p2.pokemon[k].maxhp);
      }

      const myHpDiff = battle.p1.pokemon[0].hp / battle.p1.pokemon[0].maxhp * 100 - 100;
      const oppHpDiff = battle.p2.pokemon[0].hp / battle.p2.pokemon[0].maxhp * 100 - 100;
      
      // equation1: my hp diff
      const damageRow1 = [];
      for (let k = 0; k < (myChoices.length * 2 + oppChoices.length * 2); k++) {
        if (k === 2 * i || k === (2 * j + myChoices.length * 2)) {
          damageRow1.push(1);
        } else {
          damageRow1.push(0);
        }
      }

      // equation2: opp hp diff
      const damageRow2 = [];
      for (let k = 0; k < (myChoices.length * 2 + oppChoices.length * 2); k++) {
        if (k === (2 * i + 1) || k === (2 * j + myChoices.length * 2 + 1)) {
          damageRow2.push(1);
        } else {
          damageRow2.push(0);
        }
      }

      damageMatrix.push(damageRow1);
      damageMatrix.push(damageRow2);

      damageVector.push(myHpDiff);
      damageVector.push(oppHpDiff);
    }
  }

  return { matrix: damageMatrix, vector: damageVector};
}

function calcTwoToTwoDamageArray(myPoke, oppPoke, myChoicePair, oppChoicePair, gameFormat) {
  const damageMatrix = [];
  const damageVector = [];

  logger.info(`evaluate about ${myPoke.species} vs ${oppPoke.species}`);
  for (let i = 0; i < myChoicePair.length; i++) {
    const myChoice = myChoicePair[i];
    for (let j = 0; j < oppChoicePair.length; j++) {
      const oppChoice = oppChoicePair[j];
      
      const p1 = { name: 'botPlayer', avatar: 1, team: [myPoke] };
      const p2 = { name: 'humanPlayer', avatar: 1, team: [oppPoke] };								
      const battleOptions = { format: gameFormat, rated: false, send: null, p1, p2 };
      const battle = new PcmBattle(battleOptions);
      battle.start();              
      battle.makeRequest();                   
      
      battle.choose('p1', Util.toChoiceString(myChoice, battle.p1), battle.rqid);
      battle.choose('p2', Util.toChoiceString(oppChoice, battle.p2), battle.rqid);
      logger.trace("Player action: " + Util.toChoiceString(myChoice, battle.p1));
      logger.trace("Opponent action: " + Util.toChoiceString(oppChoice, battle.p2));
      logger.trace("My Resulting Health:");
      for(let k = 0; k < battle.p1.pokemon.length; k++) {
          logger.trace(battle.p1.pokemon[k].species.name + ": " + battle.p1.pokemon[k].hp + "/" + battle.p1.pokemon[k].maxhp);
      }
      logger.trace("Opponent's Resulting Health:");
      for(let k = 0; k < battle.p2.pokemon.length; k++) {
          logger.trace(battle.p2.pokemon[k].species.name + ": " + battle.p2.pokemon[k].hp + "/" + battle.p2.pokemon[k].maxhp);
      }

      const myHpDiff = battle.p1.pokemon[0].hp / battle.p1.pokemon[0].maxhp * 100 - 100;
      const oppHpDiff = battle.p2.pokemon[0].hp / battle.p2.pokemon[0].maxhp * 100 - 100;
      

      // equation1: my hp diff
      const damageRow1 = [];
      for (let k = 0; k < (myChoicePair.length * 2 + oppChoicePair.length * 2); k++) {
        if (k === 2 * i || k === (2 * j + 4)) {
          damageRow1.push(1);
        } else {
          damageRow1.push(0);
        }
      }

      // equation2: opp hp diff
      const damageRow2 = [];
      for (let k = 0; k < (myChoicePair.length * 2 + oppChoicePair.length * 2); k++) {
        if (k === (2 * i + 1) || k === (2 * j + 5)) {
          damageRow2.push(1);
        } else {
          damageRow2.push(0);
        }
      }

      damageMatrix.push(damageRow1);
      damageMatrix.push(damageRow2);

      damageVector.push(myHpDiff);
      damageVector.push(oppHpDiff);
    }
  }

  const inverse = math.inv(damageMatrix);
  const x = math.multiply(inverse, damageVector);

  console.log(x);

  // private calcInverseMatrix(mat: number[][]) {
  //   return math.inv(mat);
  // }
}

function createCustomGameFormat() {
  const customGameFormat = Dex.getFormat(`gen8customgame`, true);
  customGameFormat.ruleset = customGameFormat.ruleset.filter(rule => rule !== 'Team Preview');
  customGameFormat.forcedLevel = 50;

  return customGameFormat;
}

function createPokemonSetFromStrategy(obj) {
  const myPoke = createPokemonSet(
    obj.species,
    obj.item, 
    obj.ability, 
    obj.nature, 
    obj.move1, 
    obj.move2, 
    obj.move3, 
    obj.move4,
    obj.ev_hp,
    obj.ev_atk, 
    obj.ev_def, 
    obj.ev_spa, 
    obj.ev_spd, 
    obj.ev_spe, 
    obj.gender, 
    obj.iv_hp,
    obj.iv_atk, 
    obj.iv_def, 
    obj.iv_spa, 
    obj.iv_spd, 
    obj.iv_spe, 
    obj.happiness, 
  );

  return myPoke;
}

function createPokemonSet(
  species_name,
  item, 
  ability, 
  nature, 
  move1, 
  move2, 
  move3, 
  move4,
  ev_hp,
  ev_atk, 
  ev_def, 
  ev_spa, 
  ev_spd, 
  ev_spe, 
  gender, 
  iv_hp,
  iv_atk, 
  iv_def, 
  iv_spa, 
  iv_spd, 
  iv_spe,
  happiness
) {

  const set = {
    name: "",
    species: species_name,
    gender: gender,
    item: item,
    ability: ability,
    level: 50, //fixed
    evs: {
      "hp": ev_hp,
      "atk": ev_atk,
      "def": ev_def,
      "spa": ev_spa,
      "spd": ev_spd,
      "spe": ev_spe
    },
    nature: nature,
    ivs: {
      "hp": iv_hp,
      "atk": iv_atk,
      "def": iv_def,
      "spa": iv_spa,
      "spd": iv_spd,
      "spe": iv_spe
    },
    moves: [
      move1,
      move2,
      move3,
      move4
    ].filter(x => x != null),
    happiness: happiness
  }

  return set
}

function stdDev(values) {
	const ave = average(values);
	const vari = variance(values, ave);
	const stdDev = Math.sqrt(vari);
	return stdDev;
}

function average(values) {
	let sum = 0;
	values.forEach(value => sum += value);
	return sum / values.length;
}

function variance(values, average) {
	let sum = 0;
	values.forEach(value => sum += Math.pow(value - average, 2));
	return sum / values.length;
}
