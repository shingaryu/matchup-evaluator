import axios, { AxiosResponse } from 'axios';
import DamageMatchup from './models/DamageMatchup';
import PokemonStrategy from './models/PokemonStrategy';

const baseUrl = process.env.REACT_APP_MATCHUP_CHART_API_URL;

type MoveDamageRes = {
  moveName: string,
  playerHPDiff: number,
  targetHPDiff: number
}

type DamageMatchupRes = {
  id: string,
  playerPokeId: string,
  playerPokeSpecies: string,
  targetPokeId: string,
  targetPokeSpecies: string,
  moveDamages: MoveDamageRes[] 
}

export async function getDamageMatchups(): Promise<AxiosResponse<DamageMatchupRes[]>> {
  return axios.get(`${baseUrl}/damageMatchups`);
}

export function damageMatchupMapper(res: DamageMatchupRes[], allStrategies: PokemonStrategy[]): DamageMatchup[] {
  const matchups: DamageMatchup[] = [];
  res.forEach(x => {
    const playerPoke = allStrategies.find(y => y.id === x.playerPokeId);
    if (!playerPoke) {
      throw new Error('Error: strategy with playerPokeId is not found');
    }
    const targetPoke = allStrategies.find(y => y.id === x.targetPokeId);
    if (!targetPoke) {
      throw new Error('Error: strategy with targetPokeId is not found');
    }

    const moveDamages = x.moveDamages.map(x => ({ move: x.moveName, playerHPDiff: x.playerHPDiff, targetHPDiff: x.targetHPDiff }));
    
    matchups.push({ playerPoke, targetPoke, moveDamages });
  });

  return matchups;
}