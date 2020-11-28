import PokemonSet from "../models/PokemonSet"

export function pokemonSetFromStrategyEntity(str: any) {
  if (!str.species) {
    throw new Error('Error: species is empty!')
  }

  const myPoke = createPokemonSet(
    str.species,
    str.item, 
    str.ability, 
    str.nature, 
    str.move1, 
    str.move2, 
    str.move3, 
    str.move4,
    str.ev_hp,
    str.ev_atk, 
    str.ev_def, 
    str.ev_spa, 
    str.ev_spd, 
    str.ev_spe, 
    str.gender, 
    str.iv_hp,
    str.iv_atk, 
    str.iv_def, 
    str.iv_spa, 
    str.iv_spd, 
    str.iv_spe, 
    str.happiness, 
  );

  return myPoke;
}

export function pokemonSetFromIdSet(idSet: any) {
  const myPoke = createPokemonSet(
    idSet.spe1_species_name,
    idSet.str1_item, 
    idSet.str1_ability, 
    idSet.str1_nature, 
    idSet.str1_move1, 
    idSet.str1_move2, 
    idSet.str1_move3, 
    idSet.str1_move4,
    idSet.str1_ev_hp,
    idSet.str1_ev_atk, 
    idSet.str1_ev_def, 
    idSet.str1_ev_spa, 
    idSet.str1_ev_spd, 
    idSet.str1_ev_spe, 
    idSet.str1_gender, 
    idSet.str1_iv_hp,
    idSet.str1_iv_atk, 
    idSet.str1_iv_def, 
    idSet.str1_iv_spa, 
    idSet.str1_iv_spd, 
    idSet.str1_iv_spe, 
    idSet.str1_happiness, 
  );

  const oppPoke = createPokemonSet(
    idSet.spe2_species_name,
    idSet.str2_item, 
    idSet.str2_ability, 
    idSet.str2_nature, 
    idSet.str2_move1, 
    idSet.str2_move2, 
    idSet.str2_move3, 
    idSet.str2_move4,
    idSet.str2_ev_hp,
    idSet.str2_ev_atk, 
    idSet.str2_ev_def, 
    idSet.str2_ev_spa, 
    idSet.str2_ev_spd, 
    idSet.str2_ev_spe, 
    idSet.str2_gender, 
    idSet.str2_iv_hp,
    idSet.str2_iv_atk, 
    idSet.str2_iv_def, 
    idSet.str2_iv_spa, 
    idSet.str2_iv_spd, 
    idSet.str2_iv_spe, 
    idSet.str2_happiness, 
  );

  return { myPoke, oppPoke }
}

export function createPokemonSet(
  species_name: string,
  item: string, 
  ability: string, 
  nature: string, 
  move1: string, 
  move2: string, 
  move3: string, 
  move4: string,
  ev_hp: number,
  ev_atk: number, 
  ev_def: number, 
  ev_spa: number, 
  ev_spd: number, 
  ev_spe: number, 
  gender: string, 
  iv_hp: number,
  iv_atk: number, 
  iv_def: number, 
  iv_spa: number, 
  iv_spd: number, 
  iv_spe: number,
  happiness: number
) {

  const set: PokemonSet = {
    name: "",
    species: species_name,
    gender: gender,
    item: item,
    ability: ability,
    level: 50, //fixed
    evs: {
      "hp": ev_hp,
      "atk": ev_atk,
      "def": ev_def,
      "spa": ev_spa,
      "spd": ev_spd,
      "spe": ev_spe
    },
    nature: nature,
    ivs: {
      "hp": iv_hp,
      "atk": iv_atk,
      "def": iv_def,
      "spa": iv_spa,
      "spd": iv_spd,
      "spe": iv_spe
    },
    moves: [
      move1,
      move2,
      move3,
      move4
    ].filter(x => x != null),
    happiness: happiness
  }

  return set
}
