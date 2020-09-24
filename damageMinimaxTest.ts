require('dotenv').config();

const { setCommanderGlobal } = require('./setCommanderGlobal');
setCommanderGlobal();

import { getPokemonStrategies } from './pokemonStrategiesApi';
import { getDamageMatchups, damageMatchupMapper } from './damageMatchupsApi';
import PokemonStrategy from './models/PokemonStrategy';
import DamageMatchup from './models/DamageMatchup';
import { DamageRaceState } from './damageRaceState';
import { DecisionTree, MinimaxTurn } from './minimaxTurn';
import * as fs from 'fs';
import moment from 'moment';

main();

async function main() {
  const startTime = moment();

  const playerPokeIndex = [7, 0, 1]; // 0:aegislash, 3:charizard, 1:azumarill
  const opponentPokeIndex = [2, 3, 1]; // 1:azumarill, 2:blissey, 7:conkeldurr

  const strategies = await (await getPokemonStrategies()).data;
  const damageMatchupsRes = await (await getDamageMatchups()).data;
  const damageMathups = damageMatchupMapper(damageMatchupsRes, strategies);

  const playerTeam = playerPokeIndex.map(x => strategies[x]);
  const opponentTeam = opponentPokeIndex.map(x => strategies[x]);

  const damageMatchupsPlayer = findTeamDamageMatchups(playerTeam, opponentTeam, damageMathups);  
  const damageMatchupsOpponent = findTeamDamageMatchups(opponentTeam, playerTeam, damageMathups);  

  const damageRaceState = new DamageRaceState(damageMatchupsPlayer, damageMatchupsOpponent, playerTeam, opponentTeam);
  const minimaxTurn = new MinimaxTurn(damageRaceState);
  const results = minimaxTurn.executeMinimax(5);
  console.log(results);

  const endTime = moment();
  const duration = moment.duration(endTime.valueOf() - startTime.valueOf());
  console.log('Finished all calculations!');
  console.log(`Elapsed time: ${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`);

  // results.tree.children.forEach(y => 
  //   y.children.forEach(x => 
  //     { x.choices = x.children = []; x.action = null; }));
  // results.tree.children.forEach(p1 => 
  //   p1.children.forEach(o1 =>
  //     o1.children.forEach(p2 =>
  //       p2.children.forEach(x =>
  //           { x.choices = x.children = []; x.action = null; }
  // ))));

  removeWeakChildren(results.tree);
  fs.writeFileSync('minimaxResult.json', JSON.stringify(results, null, '\t'));
}

function removeWeakChildren(tree: DecisionTree) {
  if (tree.type === 'max') {
    const maximumInd = maximumIndex(tree.children.map(x => x.value));
    tree.children = tree.children.filter((x, i) => i == maximumInd);
    tree.choices = tree.choices.filter((x, i) => i == maximumInd);
  } else {
    const minimumInd = minimumIndex(tree.children.map(x => x.value));
    tree.children = tree.children.filter((x, i) => i == minimumInd);
    tree.choices = tree.choices.filter((x, i) => i == minimumInd);
  }

  if (tree.children.length > 0) {
    removeWeakChildren(tree.children[0]);
  }
}

function maximumIndex(array: number[]): number {
  return maximumIndexFunc(array, x => x);
} 

function minimumIndex(array: number[]): number {
  return minimumIndexFunc(array, x => x);
} 

function maximumIndexFunc<T>(array: T[], value: (item: T) => number): number {
  const maximumValue = Math.max(...array.map(x => value(x)));
  const maximumValueIndex = array.findIndex(x => value(x) === maximumValue);
  return maximumValueIndex;
}

function minimumIndexFunc<T>(array: T[], value: (item: T) => number): number {
  const minimumValue = Math.min(...array.map(x => value(x)));
  const minimumValueIndex = array.findIndex(x => value(x) === minimumValue);
  return minimumValueIndex;
}

function findTeamDamageMatchups(myTeam: PokemonStrategy[], opponentTeam: PokemonStrategy[], damageMatchups: DamageMatchup[]) {
  const damageMatchupsForMyTeam: DamageMatchup[] = [];  

  myTeam.forEach(myPoke => {
    opponentTeam.forEach(opponentPoke => {
      const matchup = damageMatchups.find(x => x.playerPoke.id === myPoke.id && x.targetPoke.id === opponentPoke.id);
      if (!matchup) {
        throw new Error('Error: corresponding damage matchup was not found');
      }
      damageMatchupsForMyTeam.push(matchup);
    })
  });

  return damageMatchupsForMyTeam;
}
