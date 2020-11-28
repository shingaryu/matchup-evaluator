import PokemonSet from "../models/PokemonSet";
import * as Mapper from "./mapper";

const { Dex, PcmBattle, Minimax, Util } = require('percymon');
const { sqlService } = require('../repositories/sql-service');
const validatePokemonSets = require('./team-validate-service').validatePokemonSets;
const logger = require('log4js').getLogger("bot");

export async function calcAndInsertFromRawId(playerPokeId: string, targetPokeId: string, weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton: number, calculatedAt: any) {
  const str1 = (await sqlService.selectPokemonStrategy(playerPokeId))[0];
  const str2 = (await sqlService.selectPokemonStrategy(targetPokeId))[0];
  const myPoke = Mapper.pokemonSetFromStrategyEntity(str1);
  const oppPoke = Mapper.pokemonSetFromStrategyEntity(str2);

  return calcAndInsertFromPokemonSets(playerPokeId, targetPokeId, myPoke, oppPoke, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt);
}

export async function calcAndInsertForIdSet(idSet: any, weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton: number, calculatedAt: any) {
  const { myPoke, oppPoke } = Mapper.pokemonSetFromIdSet(idSet);

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
