function setCommanderGlobal() {
  // Command-line Arguments
  global.program = require('commander');
  global.program
  .option('-d --depth [depth]', "Minimax bot searches to this depth in the matchup evaluation. [2]", "2")
  .option('-n, --numoftrials [numoftrials]', "Each matchup evaluation is iterated and averaged by the number of trials. [10]", "10")
  .option('-r, --fetchSpanSecond [fetchSpanSecond]', "Fetch and retry the evaluation after this second when there is no evaluation found. [10]", "10")
  .option('--as-worker, [asWorker]', "(Cluster evaluation) Start all nodes as workers and omit initialization work.", false)
  .parse(process.argv);

  // need to call after global is set
  const { initLog4js } = require('percymon');

  //Setup Logging
  initLog4js(true, true);

  return global.program;
}

module.exports.setCommanderGlobal = setCommanderGlobal;