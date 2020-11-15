function setCommanderGlobal() {
  // Command-line Arguments
  global.program = require('commander');
  global.program
  .option('--net [action]', "'create' - generate a new network. 'update' - use and modify existing network. 'use' - use, but don't modify network. 'none' - use hardcoded weights. ['none']", 'none')
  .option('-d --depth [depth]', "Minimax bot searches to this depth in the matchup evaluation. [2]", "2")
  .option('--nolog', "Don't append to log files.")
  .option('--onlyinfo [onlyinfo]', "Hide debug messages and speed up bot calculations", true)
  .option('--usechildprocess', "Use child process to execute heavy calculations with parent process keeping the connection to showdown server.")
  .option('-n, --numoftrials [numoftrials]', "Each matchup evaluation is iterated and averaged by the number of trials. [10]", "10")
  .option('-r, --fetchSpanSecond [fetchSpanSecond]', "Fetch and retry the evaluation after this second when there is no evaluation found. [10]", "10")
  .option('--as-worker, [asWorker]', "(Cluster evaluation) Start all nodes as workers and omit initialization work.", false)
  .parse(process.argv);

  // need to call after global is set
  const { initLog4js } = require('percymon');

  //Setup Logging
  initLog4js(global.program.nolog, global.program.onlyinfo);

  return global.program;
}

module.exports.setCommanderGlobal = setCommanderGlobal;