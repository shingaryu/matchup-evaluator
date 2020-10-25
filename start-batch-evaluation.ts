require('dotenv').config();
const { setCommanderGlobal } = require('./setCommanderGlobal');
const commanderProgram = setCommanderGlobal();

const moment = require('moment');
const SqlService = require('./sql-service').SqlService;
import * as Eval from './matchup-evaluation-utils';

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
    const result = await Eval.calcAndInsertForIdSet(idSet, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt);
    if (result === 0) {
      succeeded++;
    } else {
      failed++;
    }
  }

  const endTime = new moment();
  const duration = moment.duration(endTime.valueOf() - startTime.valueOf());
  logger.info('Finished all calculations!');
  logger.info(`Succeeded: ${succeeded}, Failed: ${failed}`);
  logger.info(`Elapsed time: ${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`);
}
