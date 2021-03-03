require('dotenv').config();
const { setCommanderGlobal } = require('../services/setCommanderGlobal');
setCommanderGlobal();

const moment = require('moment');
import * as Eval from './matchup-evaluation-utils';
import * as evaluationQueueApi from '../repositories/evaluation-queue-api';

export async function calcAsWorker(weights: any, oneOnOneRepetition: number, minimaxDepth: number, minimaxRepetiton = 1) {
  const calculatedAt = moment().format('YYYY-MM-DD HH:mm:ss');  
  const retryingRate = 1000; //ms

  while(true) {
    try {
      let idSet = null;
      try {
        idSet = (await evaluationQueueApi.postProcessingList()).data;
      } catch(e: any) {
        console.log('error with evaluationQueueApi.postProcessingList')
        throw e;
      }

      if (!idSet) {
        console.log('There is no matchup to be calculated.');
        break;
      }

      const [playerId, targetId] = idSet.split(',');

      try {
        await Eval.calcAndInsertFromRawId(playerId, targetId, weights, oneOnOneRepetition, minimaxDepth, minimaxRepetiton, calculatedAt);
      } catch (e: any) {
        console.log('error while calc and insert. just skip this evaluation...')
      } finally {
        try {
          // note: even if calcAndInsertFromRawId catches its own error and returns 1, we will POST complete the idSet
          await evaluationQueueApi.postCompletedList(idSet);
        } catch (e: any) {
          console.log('error with evaluationQueueApi.postCompletedList')
          throw e;
        }
      }
    } catch (e) {
      console.log(`error in evaluation loop. Retrying in ${retryingRate / 1000} sec...`)
      await new Promise(r => setTimeout(r, retryingRate));
    }
  }

  console.log("finish evaluation loop...");
}
