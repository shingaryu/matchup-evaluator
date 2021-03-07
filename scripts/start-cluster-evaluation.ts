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

const fetchingRate = 100 //ms
const retryingRate = 5000; //ms

throng({
  master: async () => {
    try {
      if (!commanderProgram.asWorker) {
        process.once('SIGINT', async () => {
          console.log(`master disconnect`)
          process.exit()
        })
  
        process.once('SIGTERM', async () => {
          console.log(`master disconnect`)
          process.exit()
        })
  
        console.log(`Start master`);
        const start = new Date();
        await evaluationQueueApi.postReset();
  
        // need to run this on event loop, in order to exit master function and start forking workers 
        setTimeout(async () => {      
          while(true) {
            try {
              const targets = await (await evaluationQueueApi.getTargetsList()).data;
              const processes = await (await evaluationQueueApi.getProcessingList()).data;
              console.log(`${targets.length} evaluations in todo, ${processes.length} evaluations in progress`)
              if (targets.length === 0 && processes.length === 0) {
                console.log('all evaluation completed!');
                console.log(`elapsed time: ${(new Date().getTime() - start.getTime()) / 1000} sec`);
                // clearInterval(interval);
                console.log(`process exits...`);
                process.exit();
              } else {
                await new Promise(r => setTimeout(r, fetchingRate));
              }
            } catch (e) {
              console.log(`Error while fetching evaluation status on master. Retrying in ${retryingRate / 1000} sec...`);
              await new Promise(r => setTimeout(r, retryingRate));
            }
          }
        }, 1000);
      }
    } catch (e) {
      console.log(e.stack);
      console.log(`error with master`);
      console.log(`process exits...`);
      process.exit();
    }
  },
  worker: async(id: number, disconnect: any) => {    
    try {
      console.log(`Start worker ${id}`);
      process.once('SIGINT', async () => {
        console.log(`worker ${id} disconnect`)
        await sqlService.endConnection();
        disconnect();
      })
  
      process.once('SIGTERM', async () => {
        console.log(`worker ${id} disconnect`)
        await sqlService.endConnection();
        disconnect();
      })
      await sqlService.initConnection();
      await calcAsWorker(weights, commanderProgram.numoftrials, commanderProgram.depth, 1);
      await sqlService.endConnection();
    } catch (e) {
      console.log(e.stack);
      console.log(`error with worker ${id}`);
    }
    console.log(`worker ${id} exits...`)
    // disconnect();
  },
});
