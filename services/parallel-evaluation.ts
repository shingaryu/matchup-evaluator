require('dotenv').config();
const { setCommanderGlobal } = require('../services/setCommanderGlobal');
setCommanderGlobal();

const moment = require('moment');
import * as Eval from './matchup-evaluation-utils';
import * as evaluationQueueApi from '../repositories/evaluation-queue-api';

export async function calcAsWorker(weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton = 1) {
  const calculatedAt = moment().format('YYYY-MM-DD HH:mm:ss');  
  
  while(true) {
    const idSet = (await evaluationQueueApi.postProcessingList()).data;
    if (!idSet) {
      console.log('There is no matchup to be calculated.');
      break;
    }

    const [playerId, targetId] = idSet.split(',');
    try {
      await Eval.calcAndInsertFromRawId(playerId, targetId, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt);
      // note: even if calcAndInsertFromRawId catches its own error and returns 1, we will POST complete the idSet
      await evaluationQueueApi.postCompletedList(idSet);
    } catch (e: any) {
      console.log('error while calc and insert')
    }
  }
}
