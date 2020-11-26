import PokemonSet from "../models/PokemonSet";

const { Dex, PcmBattle, Minimax, Util } = require('percymon');
const { sqlService } = require('../repositories/sql-service');
const validatePokemonSets = require('./team-validate-service').validatePokemonSets;
const logger = require('log4js').getLogger("bot");

export async function calcAndInsertFromRawId(playerPokeId: string, targetPokeId: string, weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton: number, calculatedAt: any) {
  const str1 = (await sqlService.selectPokemonStrategy(playerPokeId))[0];
  const str2 = (await sqlService.selectPokemonStrategy(targetPokeId))[0];
  const myPoke = createPokemonSet(
    str1.species,
    str1.item, 
    str1.ability, 
    str1.nature, 
    str1.move1, 
    str1.move2, 
    str1.move3, 
    str1.move4,
    str1.ev_hp,
    str1.ev_atk, 
    str1.ev_def, 
    str1.ev_spa, 
    str1.ev_spd, 
    str1.ev_spe, 
    str1.gender, 
    str1.iv_hp,
    str1.iv_atk, 
    str1.iv_def, 
    str1.iv_spa, 
    str1.iv_spd, 
    str1.iv_spe, 
    str1.happiness, 
  );

  const oppPoke = createPokemonSet(
    str2.species,
    str2.item, 
    str2.ability, 
    str2.nature, 
    str2.move1, 
    str2.move2, 
    str2.move3, 
    str2.move4,
    str2.ev_hp,
    str2.ev_atk, 
    str2.ev_def, 
    str2.ev_spa, 
    str2.ev_spd, 
    str2.ev_spe, 
    str2.gender, 
    str2.iv_hp,
    str2.iv_atk, 
    str2.iv_def, 
    str2.iv_spa, 
    str2.iv_spd, 
    str2.iv_spe, 
    str2.happiness, 
  );

  return calcAndInsertFromPokemonSets(playerPokeId, targetPokeId, myPoke, oppPoke, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt);
}

export async function calcAndInsertForIdSet(idSet: any, weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton: number, calculatedAt: any) {
  const myPoke = createPokemonSet(
    idSet.spe1_species_name,
    idSet.str1_item, 
    idSet.str1_ability, 
    idSet.str1_nature, 
    idSet.str1_move1, 
    idSet.str1_move2, 
    idSet.str1_move3, 
    idSet.str1_move4,
    idSet.str1_ev_hp,
    idSet.str1_ev_atk, 
    idSet.str1_ev_def, 
    idSet.str1_ev_spa, 
    idSet.str1_ev_spd, 
    idSet.str1_ev_spe, 
    idSet.str1_gender, 
    idSet.str1_iv_hp,
    idSet.str1_iv_atk, 
    idSet.str1_iv_def, 
    idSet.str1_iv_spa, 
    idSet.str1_iv_spd, 
    idSet.str1_iv_spe, 
    idSet.str1_happiness, 
  );

  const oppPoke = createPokemonSet(
    idSet.spe2_species_name,
    idSet.str2_item, 
    idSet.str2_ability, 
    idSet.str2_nature, 
    idSet.str2_move1, 
    idSet.str2_move2, 
    idSet.str2_move3, 
    idSet.str2_move4,
    idSet.str2_ev_hp,
    idSet.str2_ev_atk, 
    idSet.str2_ev_def, 
    idSet.str2_ev_spa, 
    idSet.str2_ev_spd, 
    idSet.str2_ev_spe, 
    idSet.str2_gender, 
    idSet.str2_iv_hp,
    idSet.str2_iv_atk, 
    idSet.str2_iv_def, 
    idSet.str2_iv_spa, 
    idSet.str2_iv_spd, 
    idSet.str2_iv_spe, 
    idSet.str2_happiness, 
  );

  return calcAndInsertFromPokemonSets(idSet.str1_id, idSet.str2_id, myPoke, oppPoke, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt)
}

export async function calcAndInsertFromPokemonSets(playerPokeId: string, targetPokeId: string, myPoke: PokemonSet, oppPoke: PokemonSet, weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton: number, calculatedAt: any) {
  const customGameFormat = Dex.getFormat(`gen8customgame`, true);
  customGameFormat.ruleset = customGameFormat.ruleset.filter((rule: string) => rule !== 'Team Preview');
  customGameFormat.forcedLevel = 50;

  validatePokemonSets(customGameFormat, [myPoke, oppPoke]);
    
  logger.info("start evaluating matchup strength...")
  const minimax = new Minimax(false, minimaxRepetiton, false, weights);

  logger.info(`evaluate about ${myPoke.species} vs ${oppPoke.species}`);
  const repeatedOneOnOneValues = [];

  for (let k = 0; k < oneOnOneRepetition; k++) {
    const evalValuesForBothSide = [];
    // to avoid asymmetry of the minimax about evaluation values 
    for (let l = 0; l < 2; l++) {
      const p1 = { name: 'botPlayer', avatar: 1, team: l === 0? [myPoke]:[oppPoke] };
      const p2 = { name: 'humanPlayer', avatar: 1, team: l === 0? [oppPoke]:[myPoke] };								
      const battleOptions = { format: customGameFormat, rated: false, send: null, p1, p2 };
      const battle = new PcmBattle(battleOptions);
      battle.start();              
      battle.makeRequest();                   
      const decision = Util.parseRequest(battle.p1.request);
      const minimaxDecision = minimax.decide(Util.cloneBattle(battle), decision.choices, minimaxDepth);

      evalValuesForBothSide.push(minimaxDecision.tree.value);
    }

    const evalValue = (evalValuesForBothSide[0] - evalValuesForBothSide[1]) / 2;
    repeatedOneOnOneValues.push(evalValue);
  }

  const ave = average(repeatedOneOnOneValues);
  const stdD = stdDev(repeatedOneOnOneValues);
  const cv = stdD / Math.abs(ave);

  logger.info(`Matchup strength: ${ave} (stddev: ${stdD}, C.V.: ${cv})`);
  try {
    await sqlService.insertMatchupEvaluation(playerPokeId, targetPokeId, ave, calculatedAt);
    logger.info('Successfully inserted to DB');
    return 0;
  } catch (error) {
    logger.info('Failed to insert the matchup value to DB. This matchup will be skipped.');
    console.log(error);
    return 1;
  }
}

export function createPokemonSet(
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
  gender: string, 
  iv_hp: number,
  iv_atk: number, 
  iv_def: number, 
  iv_spa: number, 
  iv_spd: number, 
  iv_spe: number,
  happiness: number
) {

  const set: PokemonSet = {
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

export function stdDev(values: number[]) {
	const ave = average(values);
	const vari = variance(values, ave);
	const stdDev = Math.sqrt(vari);
	return stdDev;
}

export function average(values: number[]) {
	let sum = 0;
	values.forEach(value => sum += value);
	return sum / values.length;
}

export function variance(values: number[], average: number) {
	let sum = 0;
	values.forEach(value => sum += Math.pow(value - average, 2));
	return sum / values.length;
}
