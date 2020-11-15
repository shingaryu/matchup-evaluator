require('dotenv').config();
import throng from 'throng';
// import { calcAsService } from './start-evaluation-service';
import { calcAsWorker } from './parallel-evaluation';
import * as evaluationQueueApi from './evaluation-queue-api';

const SqlService = require('./sql-service').SqlService;
const sqlService = new SqlService();

const weights = {
  "p1_hp": 1024,
  "p2_hp": -1024,
}

const start = new Date();
const interval = setInterval(async () => {
  const evals = await sqlService.fetchAllMatchupEvaluations();
  console.log(`${evals.length} evaluations in DB`)
  if (evals.length === 21) {
    console.log('calculation seems finished!');
    console.log(`elapsed time: ${(new Date().getTime() - start.getTime()) / 1000} sec`);
    clearInterval(interval);
  }
}, 100);

// calcAsService(weights, 10, 2, 1, 1);
// throng(id => {
//   console.log(`Started worker ${id}`)
//   calcAsService(weights, 10, 2, 1, 1); 
// });

// evaluationQueueApi.postReset().then(data => {
//   calcAsWorker(weights, 30, 2, 1, 1);
// })

evaluationQueueApi.postReset().then(data => {
  throng(id => {
    console.log(`Started worker ${id}`)
    calcAsWorker(weights, 30, 2, 1, 1); 
  });
});