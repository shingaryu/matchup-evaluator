require('dotenv').config();
const { setCommanderGlobal } = require('./setCommanderGlobal');
const commanderProgram = setCommanderGlobal();

const moment = require('moment');
const SqlService = require('./sql-service').SqlService;
import * as Eval from './matchup-evaluation-utils';
import * as evaluationQueueApi from './evaluation-queue-api';

// Setup Logging
const logger = require('log4js').getLogger("bot");

const weights = {
  "p1_hp": 1024,
  "p2_hp": -1024,
}

export async function calcAsWorker(weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton = 1, fetchSpanSecond: number) {
  const calculatedAt = moment().format('YYYY-MM-DD HH:mm:ss');  
  
  while(true) {
    const idSet = (await evaluationQueueApi.postProcessingList()).data;
    console.log('idset')
    console.log(idSet);
    if (!idSet) {
      console.log('There is no matchup to be calculated.');
      break;
    }

    const [playerId, targetId] = idSet.split(',');
    try {
      await Eval.calcAndInsertFromRawId(playerId, targetId, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt);
    } catch (e: any) {
      console.log('error while calc and insert')
    }

    await evaluationQueueApi.postCompletedList(idSet);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
