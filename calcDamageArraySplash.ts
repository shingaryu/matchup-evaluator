// // Command-line Arguments
// const program = require('commander');
// program
// .option('--net [action]', "'create' - generate a new network. 'update' - use and modify existing network. 'use' - use, but don't modify network. 'none' - use hardcoded weights. ['none']", 'none')
// .option('-d --depth [depth]', "Minimax bot searches to this depth in the matchup evaluation. [2]", "2")
// .option('--nolog', "Don't append to log files.")
// .option('--onlyinfo [onlyinfo]', "Hide debug messages and speed up bot calculations", true)
// .option('--usechildprocess', "Use child process to execute heavy calculations with parent process keeping the connection to showdown server.")
// .option('-n, --numoftrials [numoftrials]', "Each matchup evaluation is iterated and averaged by the number of trials. [10]", "10")
// .parse(process.argv);

type MoveDamage = {
  move: string,
  playerHPDiff: number,
  targetHPDiff: number
}

type DamageMatchup = {
  playerPoke: PokemonStrategy,
  targetPoke: PokemonStrategy,
  moveDamages: MoveDamage[]
}

// import {setCommanderGlobal} from './setCommanderGlobal';
const { setCommanderGlobal } = require('./setCommanderGlobal');
setCommanderGlobal();

const { Dex, PcmBattle, Minimax, initLog4js, Util } = require('percymon');
import moment from 'moment';
// const SqlService = require('./sql-service').SqlService;
// const getPokemonStrategies = require('./pokemonStrategiesApi').getPokemonStrategies;
import { getPokemonStrategies } from './pokemonStrategiesApi';
const validatePokemonSets = require('./team-validate-service').validatePokemonSets;
import * as math from 'mathjs';
import PokemonStrategy from './models/PokemonStrategy';
import Nature from './models/Nature';
import Gender from './models/Gender';
import { number } from 'mathjs';
// import { SqlService } from './sql-service';
const SqlService = require('./sql-service').SqlService;

// Setup Logging
// initLog4js(program.nolog, program.onlyinfo);
const logger = require('log4js').getLogger("bot");

calcDamageArray();

async function calcDamageArray () {
  const iteration = 10;
  const startTime = new Date();

  const strategiesRes = await getPokemonStrategies();
  const strategies = strategiesRes.data;
  const customGameFormat = createCustomGameFormat();
  const sqlService = new SqlService();
  for (let i = 0; i < strategies.length; i++) {
    for (let j = 0; j < strategies.length; j++) {   
    // for (let i = 0; i < 4; i++) {
    //   for (let j = 0; j < 4; j++) {   
      // const myPoke = createPokemonSetFromStrategy(strategies[i]);
      // const oppPoke = createPokemonSetFromStrategy(strategies[j]);
      // validatePokemonSets(customGameFormat, [myPoke, oppPoke]);
      try {
        const result = calcDamageMatrixWithSplash(strategies[i], strategies[j], customGameFormat, iteration);
        console.log(result)
  
        await sqlService.insertDamageMatchup(result);
      } catch (e) {
        console.log(e);
        console.log('skip this matchup and continue...');
      }
    }
    
  }

   const endTime = new Date();
   console.log(`${endTime.getUTCMilliseconds() - startTime.getUTCMilliseconds()} milliseconds`)
   const duration = moment.duration(endTime.getUTCMilliseconds() - startTime.getUTCMilliseconds());
   logger.info('Finished all calculations!');
   logger.info(`Elapsed time: ${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`);
}

function calcDamageMatrixWithSplash(playerPokeStr: PokemonStrategy, targetPokeStr: PokemonStrategy, gameFormat: any, iteration: number) {
  const targetMock: PokemonStrategy = { ...targetPokeStr, move1: 'Splash', move2: "", move3: "", move4: "" };

  const myPoke = createPokemonSetFromStrategy(playerPokeStr);
  const oppPoke = createPokemonSetFromStrategy(targetMock);

  const myChoiceNum = myPoke.moves.length;
  const myMoves = [playerPokeStr.move1, playerPokeStr.move2, playerPokeStr.move3, playerPokeStr.move4];
  const damages: MoveDamage[] = [];

  logger.info(`evaluate about ${myPoke.species} vs ${oppPoke.species}`);
  for (let i = 0; i < myChoiceNum; i++) {      
    const myHpDamageResults: number[] = [];
    const oppHpDamageResults: number[] = [];
    const myHpRecoverResults: number[] = [];
    const oppHpRecoverResults: number[] = [];
    for (let j = 0; j < iteration; j++) {     
      const battle1 = simulateMatchup(myPoke, oppPoke, i, gameFormat, false);
      const myHpDiff = battle1.p1.pokemon[0].hp / battle1.p1.pokemon[0].maxhp * 100 - 100;
      const oppHpDiff = battle1.p2.pokemon[0].hp / battle1.p2.pokemon[0].maxhp * 100 - 100;
      myHpDamageResults.push(myHpDiff);
      oppHpDamageResults.push(oppHpDiff);

      const battle2 = simulateMatchup(myPoke, oppPoke, i, gameFormat, true);
      const myHpRecovery = (battle2.p1.pokemon[0].hp - 1) / battle2.p1.pokemon[0].maxhp * 100;
      const oppHpRecovery = (battle2.p2.pokemon[0].hp - 1) / battle2.p2.pokemon[0].maxhp * 100;
      myHpRecoverResults.push(myHpRecovery);
      oppHpRecoverResults.push(oppHpRecovery);
    }
    
    const damage: MoveDamage = {
      move: myMoves[i],
      playerHPDiff: average(myHpDamageResults) + average(myHpRecoverResults),
      targetHPDiff: average(oppHpDamageResults) + average(oppHpRecoverResults)
    }

    damages.push(damage);
  }
  const result: DamageMatchup = {
    playerPoke: playerPokeStr,
    targetPoke: targetPokeStr,
    moveDamages: damages
  }
  
  return result;
}

function simulateMatchup(myPoke: any, oppPoke: any, myMoveIndex: number, gameFormat: any, calcRecovery?: boolean) {
  const p1 = { name: 'botPlayer', avatar: 1, team: [myPoke] };
  const p2 = { name: 'humanPlayer', avatar: 1, team: [oppPoke] };								
  const battleOptions = { format: gameFormat, rated: false, send: null, p1, p2 };
  const battle = new PcmBattle(battleOptions);
  if (calcRecovery) {
    ReducePokemonHP(battle);
  }
  battle.start();              
  battle.makeRequest();                   
  
  const choicesP1 = Util.parseRequest(battle.p1.request).choices;
  const choicesP2 = Util.parseRequest(battle.p2.request).choices;   
  const filtChoicesP1 = choicesP1.filter((choice: any) => choice.type == "move" && !choice.runDynamax); 
  const filtChoicesP2 = choicesP2.filter((choice: any) => choice.type == "move" && !choice.runDynamax); 

  battle.choose('p1', Util.toChoiceString(filtChoicesP1[myMoveIndex], battle.p1), battle.rqid);
  battle.choose('p2', Util.toChoiceString(filtChoicesP2[0], battle.p2), battle.rqid);
  logger.trace("Player action: " + Util.toChoiceString(filtChoicesP1[myMoveIndex], battle.p1));
  logger.trace("Opponent action: " + Util.toChoiceString(filtChoicesP2[0], battle.p2));
  logger.trace("My Resulting Health:");
  for(let k = 0; k < battle.p1.pokemon.length; k++) {
      logger.trace(battle.p1.pokemon[k].species.name + ": " + battle.p1.pokemon[k].hp + "/" + battle.p1.pokemon[k].maxhp);
  }
  logger.trace("Opponent's Resulting Health:");
  for(let k = 0; k < battle.p2.pokemon.length; k++) {
      logger.trace(battle.p2.pokemon[k].species.name + ": " + battle.p2.pokemon[k].hp + "/" + battle.p2.pokemon[k].maxhp);
  }

  return battle;
}

function createCustomGameFormat() {
  const customGameFormat = Dex.getFormat(`gen8customgame`, true);
  customGameFormat.ruleset = customGameFormat.ruleset.filter((rule: any) => rule !== 'Team Preview');
  customGameFormat.forcedLevel = 50;

  return customGameFormat;
}

function createPokemonSetFromStrategy(obj: PokemonStrategy) {
  const myPoke = createPokemonSet(
    obj.species,
    obj.item, 
    obj.ability, 
    obj.nature ? obj.nature.toString(): '', 
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
    obj.gender ? obj.gender.toString(): null, 
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
  species_name: string,
  item: string, 
  ability: string, 
  nature: string, 
  move1: string, 
  move2: string, 
  move3: string, 
  move4: string,
  ev_hp: number,
  ev_atk: number, 
  ev_def: number, 
  ev_spa: number, 
  ev_spd: number, 
  ev_spe: number, 
  gender: string | null, 
  iv_hp: number,
  iv_atk: number, 
  iv_def: number, 
  iv_spa: number, 
  iv_spd: number, 
  iv_spe: number,
  happiness: number | null
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

function average(values: number[]) {
	let sum = 0;
	values.forEach(value => sum += value);
	return sum / values.length;
}

function ReducePokemonHP(battle: any) {
  // battle.p1.pokemon[0].hp = Math.round(battle.p1.pokemon[0].maxhp / 2);
  // battle.p2.pokemon[0].hp = Math.round(battle.p2.pokemon[0].maxhp / 2);
  // battle.p1.pokemon[0].hp = battle.p1.pokemon[0].maxhp / 2;
  // battle.p2.pokemon[0].hp = battle.p2.pokemon[0].maxhp / 2;
  battle.p1.pokemon[0].hp = battle.p1.pokemon[0].hp = 1;
  battle.p2.pokemon[0].hp = battle.p2.pokemon[0].hp = 1;

  updatePokemon(battle.p1, battle.p1.pokemon[0]);
  updatePokemon(battle.p2, battle.p2.pokemon[0]);
}

//given a player and a pokemon, updates that pokemon in the battleside object
function updatePokemon(battleside: any, pokemon: any) {
  for(let i = 0; i < battleside.pokemon.length; i++) {
      if(battleside.pokemon[i].name === pokemon.name) {
          battleside.pokemon[i] = pokemon;
          return;
      }
  }
  logger.info("Could not find " + pokemon.name + " in the battle side, creating new Pokemon.");
  for(let i = battleside.pokemon.length - 1; i >= 0; i--) {
      if(battleside.pokemon[i].name === "Bulbasaur") {
          battleside.pokemon[i] = pokemon;
          return;
      }
  }
}