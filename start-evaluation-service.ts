require('dotenv').config();
const { setCommanderGlobal } = require('./setCommanderGlobal');
const commanderProgram = setCommanderGlobal();

const moment = require('moment');
const { sqlService } = require('./sql-service');
import * as Eval from './matchup-evaluation-utils';

// Setup Logging
const logger = require('log4js').getLogger("bot");

const weights = {
  "p1_hp": 1024,
  "p2_hp": -1024,
}

calcAsService(weights, commanderProgram.numoftrials, commanderProgram.depth, 1, commanderProgram.fetchSpanSecond);

async function calcAsService(weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton = 1, fetchSpanSecond: number) {
  const calculatedAt = moment().format('YYYY-MM-DD HH:mm:ss');  
  let targetStrategyIdSets: any;
  
  while(true) {
    targetStrategyIdSets = await sqlService.fetchTargetStrategyIdSets();

    if (targetStrategyIdSets.length === 0) {
      logger.info(`There is no matchup to be calculated. Retrying in ${fetchSpanSecond} seconds...`)
      await sleep(fetchSpanSecond * 1000);
      continue;
    } else {
      logger.info(`${targetStrategyIdSets.length} matchups are remaining`)

      const idSet = targetStrategyIdSets[0];
      await Eval.calcAndInsertForIdSet(idSet, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt);
    }
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
