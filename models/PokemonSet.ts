type PokemonSet = {
  name: string,
  species: string,
  gender: string,
  item: string,
  ability: string,
  level: number,
  evs: {
    hp: number,
    atk: number,
    def: number,
    spa: number,
    spd: number,
    spe: number
  },
  nature: string,
  ivs: {
    hp: number,
    atk: number,
    def: number,
    spa: number,
    spd: number,
    spe: number
  },
  moves: string[],
  happiness: number
}

export default PokemonSet;