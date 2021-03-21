require('dotenv').config();

const fs = require('fs');
const { sqlService } = require('../repositories/sql-service');
const { TeamImporter, Dex, PcmBattle, PcmPokemon } = require('percymon');
const mapper = require('../services/mapper')

type PokemonFeature = {
  id: string,
  hp: number,
  atk: number,
  def: number,
  spa: number,
  spd: number,
  spe: number,
  ability: string,
  types: string[],
  moves: string[],
  item: string
}

mainFunc()

async function mainFunc() {
  const allEvaluations = await sqlService.fetchAllMatchupEvaluations();
  // const allStrategies = await sqlService.selectAllPokemonStrategyId();

  const ids: string[] = [];
  const featurePairs: PokemonFeature[][] = [];
  const matchupValues: number[] = [];
  for (const evaluation of allEvaluations) {
    const pair: PokemonFeature[] = [];
    const playerPokeId = evaluation.player_poke_id;
    const targetPokeId = evaluation.target_poke_id;
    
    pair.push(await featureFromStrId(playerPokeId));
    pair.push(await featureFromStrId(targetPokeId));
    ids.push(evaluation.id);
    featurePairs.push(pair);
    matchupValues.push(evaluation.value);
  }

  writeFeaturesToCsv('matchup_value_features.csv', ids, featurePairs, matchupValues);
}

function writeFeaturesToCsv(filename: string, ids: string[], featurePairs: PokemonFeature[][], matchupValues: number[]) {
  const header = [
    "id", 
    "p1_hp", 
    "p1_atk", 
    "p1_def", 
    "p1_spa", 
    "p1_spd", 
    "p1_spe", 
    "p1_ability", 
    "p1_type1", 
    "p1_type2", 
    "p1_move1", 
    "p1_move2", 
    "p1_move3", 
    "p1_move4", 
    "p1_item", 
    "p2_hp", 
    "p2_atk", 
    "p2_def", 
    "p2_spa", 
    "p2_spd", 
    "p2_spe", 
    "p2_ability", 
    "p2_type1", 
    "p2_type2", 
    "p2_move1", 
    "p2_move2", 
    "p2_move3", 
    "p2_move4", 
    "p2_item", 
    "matchup_value"
  ];

  let csvText = '';
  // header.forEach(columnName => csvText += ','+ columnName);
  csvText += header.join(",")
  csvText += '\n';

  for (let i = 0; i < featurePairs.length; i++) {
    csvText += ids[i] + ',';
    csvText += featureToRecord(featurePairs[i][0]).join(',') + ',';
    csvText += featureToRecord(featurePairs[i][1]).join(',') + ',';
    csvText += matchupValues[i].toFixed(0);
    csvText += '\n';
  }

  fs.writeFileSync(filename, csvText);
  console.log(`matchup value feature is saved to ${filename}`)
}

function featureToRecord(feature: PokemonFeature) {
  let records = [
    feature.hp,
    feature.atk,
    feature.def,
    feature.spa,
    feature.spd,
    feature.spe,
    feature.ability,
    feature.types.length > 0? feature.types[0]: "",
    feature.types.length > 1? feature.types[1]: "",
    feature.moves.length > 0? feature.moves[0]: "",
    feature.moves.length > 1? feature.moves[1]: "",
    feature.moves.length > 2? feature.moves[2]: "",
    feature.moves.length > 3? feature.moves[3]: "",
  ];  

  records.push(feature.item);  

  return records;
} 

async function featureFromStrId(strId) {
  // const strEntity = allStrategies.find(x => x.id === strId);
  // if (!strEntity) {
  //   throw new Error(`player poke ${strId} is not found in strategy list`)
  // }

  const [strEntity] = await sqlService.selectPokemonStrategy(strId);

  const pokemonSet = mapper.pokemonSetFromStrategyEntity(strEntity);
  const battle = gen8Battle([pokemonSet], [pokemonSet]);
  const activePokemon = battle.p1.pokemon[0];
  const feature = featureFromBattlePokemon(strId, activePokemon);

  return feature;
}

function gen8WOTeamPrev() {
  const customGameFormat = Dex.getFormat(`gen8customgame`, true);
  customGameFormat.ruleset = customGameFormat.ruleset.filter((rule: string) => rule !== 'Team Preview');
  customGameFormat.forcedLevel = 50;

  return customGameFormat;
}

function gen8BattleOptions(myTeam, oppTeam) {
  const p1 = { name: 'botPlayer', avatar: 1, team: myTeam };
  const p2 = { name: 'humanPlayer', avatar: 1, team: oppTeam };								
  const battleOptions = { format: gen8WOTeamPrev(), rated: false, send: null, p1, p2 };

  return battleOptions;
}

function gen8Battle(myTeam, oppTeam) {
  return new PcmBattle(gen8BattleOptions(myTeam, oppTeam));
}

function featureFromBattlePokemon(id, pokemon): PokemonFeature {
  const feature = {
    id: id,
    hp: pokemon.baseStoredStats.hp,
    atk: pokemon.baseStoredStats.atk,
    def: pokemon.baseStoredStats.def,
    spa: pokemon.baseStoredStats.spa,
    spd: pokemon.baseStoredStats.spd,
    spe: pokemon.baseStoredStats.spe,
    ability: pokemon.ability,
    types: pokemon.types,
    moves: pokemon.moveSlots.map(x => x.move),
    // moves: pokemon.moves,
    item: pokemon.item
  }
  return feature;
}