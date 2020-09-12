import PokemonStrategy from "./PokemonStrategy";
import MoveDamage from "./MoveDamage";

type DamageMatchup = {
  playerPoke: PokemonStrategy,
  targetPoke: PokemonStrategy,
  moveDamages: MoveDamage[]
}

export default DamageMatchup;