require('dotenv').config();
const { setCommanderGlobal } = require('./setCommanderGlobal');
const commanderProgram = setCommanderGlobal();

const { Dex, PcmBattle, Minimax, Util } = require('percymon');
const moment = require('moment');

const SqlService = require('./sql-service').SqlService;
const validatePokemonSets = require('./team-validate-service').validatePokemonSets;

// Setup Logging
const logger = require('log4js').getLogger("bot");

const weights = {
  "p1_hp": 1024,
  "p2_hp": -1024,
}

calcMatupFromIdSets(weights, commanderProgram.numoftrials, commanderProgram.depth, 1);

async function calcMatupFromIdSets (weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton = 1) {
  const startTime = new moment();
  const sqlForIdSets = new SqlService();
  const calculatedAt = moment().format('YYYY-MM-DD HH:mm:ss');  
  const targetStrategyIdSets = await sqlForIdSets.fetchTargetStrategyIdSets();
  sqlForIdSets.endConnection();

  if (targetStrategyIdSets.length === 0) {
    logger.info('There is no matchup to be calculated. App is being closed...')
    return;
  } else {
    logger.info(`${targetStrategyIdSets.length} matchup(s) to be calculated`)
  }

  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < targetStrategyIdSets.length; i++) {
    const idSet = targetStrategyIdSets[i];
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
    const sqlForInsert = new SqlService();
    try {
      await sqlForInsert.insertMatchupEvaluation(idSet.str1_id, idSet.str2_id, ave, calculatedAt);
      sqlForInsert.endConnection();
      succeeded++;
      logger.info('Successfully inserted to DB');
    } catch (error) {
      logger.info('Failed to insert the matchup value to DB. This matchup will be skipped.');
      sqlForInsert.endConnection();
      failed++;
      console.log(error);
    }
  }

  const endTime = new moment();
  const duration = moment.duration(endTime.valueOf() - startTime.valueOf());
  logger.info('Finished all calculations!');
  logger.info(`Succeeded: ${succeeded}, Failed: ${failed}`);
  logger.info(`Elapsed time: ${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`);
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
  gender: string, 
  iv_hp: number,
  iv_atk: number, 
  iv_def: number, 
  iv_spa: number, 
  iv_spd: number, 
  iv_spe: number,
  happiness: number
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

function stdDev(values: number[]) {
	const ave = average(values);
	const vari = variance(values, ave);
	const stdDev = Math.sqrt(vari);
	return stdDev;
}

function average(values: number[]) {
	let sum = 0;
	values.forEach(value => sum += value);
	return sum / values.length;
}

function variance(values: number[], average: number) {
	let sum = 0;
	values.forEach(value => sum += Math.pow(value - average, 2));
	return sum / values.length;
}
