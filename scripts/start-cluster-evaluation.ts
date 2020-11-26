require('dotenv').config();
const { setCommanderGlobal } = require('../services/setCommanderGlobal');
const commanderProgram = setCommanderGlobal();
const throng = require('throng');
import { calcAsWorker } from '../services/parallel-evaluation';
import * as evaluationQueueApi from '../repositories/evaluation-queue-api';

const { sqlService } = require('../repositories/sql-service');

const weights = {
  "p1_hp": 1024,
  "p2_hp": -1024,
}

throng({
  master: async () => {
    if (!commanderProgram.asWorker) {
      console.log(`Start master`);
      const start = new Date();
      await evaluationQueueApi.postReset();      
      const interval = setInterval(async () => {
        const evals = await sqlService.fetchAllMatchupEvaluations();
        console.log(`${evals.length} evaluations in DB`)
        if (evals.length === 21) {
          console.log('calculation seems finished!');
          console.log(`elapsed time: ${(new Date().getTime() - start.getTime()) / 1000} sec`);
          clearInterval(interval);
        }
      }, 100);
    }
  },
  worker: (id: number, disconnect: any) => {
    console.log(`Start worker ${id}`);
    calcAsWorker(weights, commanderProgram.numoftrials, commanderProgram.depth, 1); 
  },
});
