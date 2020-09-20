require('dotenv').config();

const { setCommanderGlobal } = require('./setCommanderGlobal');
setCommanderGlobal();

import { getPokemonStrategies } from './pokemonStrategiesApi';
import { getDamageMatchups, damageMatchupMapper } from './damageMatchupsApi';
import PokemonStrategy from './models/PokemonStrategy';
import DamageMatchup from './models/DamageMatchup';
import { DamageRaceState } from './damageRaceState';
import { MinimaxTurn } from './minimaxTurn';

main();

async function main() {
  const playerPokeIndex = [0, 3, 1]; // aegislash, charizard, azumarill
  const opponentPokeIndex = [1, 2, 7]; // azumarill, blissey, conkeldurr

  const strategies = await (await getPokemonStrategies()).data;
  const damageMatchupsRes = await (await getDamageMatchups()).data;
  const damageMathups = damageMatchupMapper(damageMatchupsRes, strategies);

  const playerTeam = playerPokeIndex.map(x => strategies[x]);
  const opponentTeam = opponentPokeIndex.map(x => strategies[x]);

  const damageMatchupsPlayer = findTeamDamageMatchups(playerTeam, opponentTeam, damageMathups);  
  const damageMatchupsOpponent = findTeamDamageMatchups(opponentTeam, playerTeam, damageMathups);  

  const damageRaceState = new DamageRaceState(damageMatchupsPlayer, damageMatchupsOpponent, playerTeam, opponentTeam);
  const minimaxTurn = new MinimaxTurn(damageRaceState);
  const results = minimaxTurn.executeMinimax(1);

  console.log(results);
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
