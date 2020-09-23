import { GameState } from "./minimaxTurn";
import DamageMatchup from "./models/DamageMatchup";
import PokemonStrategy from "./models/PokemonStrategy";

export type DamageRacePokemon = {
  pokemonStrategy: PokemonStrategy,
  hpRatio: number,
  isFainted: boolean,
}

export type DamageRaceChoice = {
  type: number,
  // choiceContent: MoveChoice | SwitchChoice,
  moveSlot?: number,
  moveName?: string,
  switchTo?: number,
  displayName: string
}

export type MoveChoice = {
  moveSlot: number,
  moveName: string,
}

export type SwitchChoice = {
  switchTo: number
}

export type ChoiceRequest = {
  canMove: boolean,
  canSwitch: boolean
}

export class DamageRaceState implements GameState<DamageRaceChoice>  {
  protected damageMatchupsPlayer: DamageMatchup[];
  protected damageMatchupsOpponent: DamageMatchup[];

  playerActive: DamageRacePokemon;
  // playerActiveSlot: number;
  opponentActive: DamageRacePokemon;
  // opponentActiveSlot: number;
  playerPokemon: DamageRacePokemon[];
  opponentPokemon: DamageRacePokemon[];

  storedPlayerChoice: DamageRaceChoice | null;
  storedOpponentChoice: DamageRaceChoice | null;
  isChoicesReady: boolean;
  playerChoiceRequest: ChoiceRequest;
  opponentChoiceRequest: ChoiceRequest;

  constructor(damageMatchupsPlayer: DamageMatchup[], damageMatchupsOpponent: DamageMatchup[],
    playerTeam: PokemonStrategy[], opponentTeam: PokemonStrategy[]) {

    this.damageMatchupsPlayer = damageMatchupsPlayer;
    this.damageMatchupsOpponent = damageMatchupsOpponent;

    this.playerPokemon = playerTeam.map(x => ({ pokemonStrategy: x, hpRatio: 100, isFainted: false}));
    this.opponentPokemon = opponentTeam.map(x => ({ pokemonStrategy: x, hpRatio: 100, isFainted: false}));
    this.playerActive = this.playerPokemon[0];
    this.opponentActive = this.opponentPokemon[0];

    this.playerChoiceRequest = { canMove: true, canSwitch: true};
    this.opponentChoiceRequest = { canMove: true, canSwitch: true};

    this.storedPlayerChoice = null;
    this.storedOpponentChoice = null;
    this.isChoicesReady = false;
  }

  playerChoices(): DamageRaceChoice[] {
    return this.createChoices(this.playerChoiceRequest, this.playerActive, this.playerPokemon);
  }

  opponentChoices(): DamageRaceChoice[] {
    return this.createChoices(this.opponentChoiceRequest, this.opponentActive, this.opponentPokemon);
  }

  createChoices(request: ChoiceRequest, active: DamageRacePokemon, pokemon: DamageRacePokemon[]): DamageRaceChoice[] {
    const choices: DamageRaceChoice[] = [];

    if (request.canMove) {
      choices.push({ type: 0, moveSlot: 0, moveName: active.pokemonStrategy.move1, displayName: `${active.pokemonStrategy.move1}`});
      choices.push({ type: 0, moveSlot: 1, moveName: active.pokemonStrategy.move2, displayName: `${active.pokemonStrategy.move2}`});
      choices.push({ type: 0, moveSlot: 2, moveName: active.pokemonStrategy.move3, displayName: `${active.pokemonStrategy.move3}`});
      choices.push({ type: 0, moveSlot: 3, moveName: active.pokemonStrategy.move4, displayName: `${active.pokemonStrategy.move4}`});
    }

    if (request.canSwitch) {
      const alivePokemonindices = pokemon.map((x, i) => ({poke: x, i: i}))
      .filter((x) => x.poke !== active)
      .filter((x) => !x.poke.isFainted)
      .map(x => x.i);

      alivePokemonindices.forEach(x => choices.push({ type: 1, switchTo: x, displayName: `${pokemon[x].pokemonStrategy.species}`}));
    }
    
    return choices;
  }

  staticEvaluateValue(): number {
    let playerHpSum = 0;
    this.playerPokemon.forEach(x => playerHpSum += x.hpRatio);

    let opponentHpSum = 0;
    this.opponentPokemon.forEach(x => opponentHpSum += x.hpRatio);

    return playerHpSum - opponentHpSum;
  }

  isSubTree(): boolean {
    const alivePlayerPokemonNum = this.playerPokemon.filter(x => !x.isFainted).length;
    const aliveOpponentPokemonNum = this.opponentPokemon.filter(x => !x.isFainted).length;

    if (this.isEnd()) {
      return false;
    }

    // waiting for the switch
    if (this.playerActive.isFainted && alivePlayerPokemonNum >= 1){
      return true;
    }

    // waiting for the switch
    if (this.opponentActive.isFainted && aliveOpponentPokemonNum >= 1){
      return true;
    }

    return false;
  }

  isEnd(): boolean {
    let isEnd = true;
    isEnd = this.playerPokemon.every(x => x.isFainted);
    isEnd = this.opponentPokemon.every(x => x.isFainted);

    return isEnd;
  }

  executePlayerChoice(choice: DamageRaceChoice): void {
    // todo: choice type validation
    this.storedPlayerChoice = choice;
    this.playerChoiceRequest = { canMove: false, canSwitch: false }; 

    this.isChoicesReady = this.isChoicesSubmitted();
    if (this.isChoicesReady) {
      this.executeDamageInteraction();
    }
  }

  executeOpponentChoice(choice: DamageRaceChoice): void {
    // todo: choice type validation
    this.storedOpponentChoice = choice;
    this.opponentChoiceRequest = { canMove: false, canSwitch: false }; 

    this.isChoicesReady = this.isChoicesSubmitted();
    if (this.isChoicesReady) {
      this.executeDamageInteraction();
    }
  }

  executeDamageInteraction(): void {
    this.isChoicesReady = false;

    let canContinue = false;
    canContinue = this.processSwitchPhase(this.storedPlayerChoice, this.storedOpponentChoice);
    if (canContinue) {
      canContinue = this.processMovePhase();
    }

    this.processAfterMoveRequest();
  }

  processSwitchPhase(playerChoice: DamageRaceChoice | null, opponentChoice: DamageRaceChoice | null): boolean {
    // todo: speed priorities

    if (playerChoice?.type === 1) {
      // this.playerActiveSlot = playerChoice.switchTo;
      if (playerChoice.switchTo == null) {
        throw new Error('Error: switchTo is not defined');
      }
      this.playerActive = this.playerPokemon[playerChoice.switchTo];
      this.storedPlayerChoice = null;
      return true;
    }

    if (opponentChoice?.type === 1) {
      // this.opponentActiveSlot = opponentChoice.switchTo;
      if (opponentChoice.switchTo == null) {
        throw new Error('Error: switchTo is not defined');
      }
      this.opponentActive = this.opponentPokemon[opponentChoice.switchTo];
      this.storedOpponentChoice = null;
      return true;
    }

    return true;
  }

  processMovePhase(): boolean {
    // todo: speed priorities

    this.processMoveChoice(this.storedPlayerChoice, this.damageMatchupsPlayer, this.playerActive, this.opponentActive);
    this.storedPlayerChoice = null;

    this.processMoveChoice(this.storedOpponentChoice, this.damageMatchupsOpponent, this.opponentActive, this.playerActive);
    this.storedOpponentChoice = null;

    return true;
  }

  processMoveChoice(choice: DamageRaceChoice | null, matchups: DamageMatchup[], playerActive: DamageRacePokemon, opponentActive: DamageRacePokemon, ): boolean {
    if (choice?.type === 0) {
      this.storedPlayerChoice = null;
      if (this.playerActive.isFainted || this.opponentActive.isFainted) {
        return true;
      }

      const damageMatchupPToO = matchups.find(x => 
        (x.playerPoke.id === playerActive.pokemonStrategy.id) && (x.targetPoke.id === opponentActive.pokemonStrategy.id));
      if (!damageMatchupPToO) {
        throw new Error('Error: corresponding damage matchup was not found');
      }
      if (choice.moveSlot == undefined) {
        throw new Error('Error: moveSlot is not defined');
      }
      const moveDamage = damageMatchupPToO.moveDamages[choice.moveSlot];
      if (moveDamage.move !== choice.moveName) {
        throw new Error('Error: move name is not match between damage matchup and choice');
      } 

      playerActive.hpRatio += moveDamage.playerHPDiff;
      opponentActive.hpRatio += moveDamage.targetHPDiff;
      if (playerActive.hpRatio <= 0) {
        playerActive.hpRatio = 0;
        playerActive.isFainted = true;
      }
      if (opponentActive.hpRatio <= 0) {
        opponentActive.hpRatio = 0;
        opponentActive.isFainted = true;
      }
      if (playerActive.hpRatio > 100) {
        playerActive.hpRatio = 100;
      }
      if (opponentActive.hpRatio > 100) {
        opponentActive.hpRatio = 100;
      }
    }

    return true;
  }

  processAfterMoveRequest(): void {
    const alivePlayerPokemonNum = this.playerPokemon.filter(x => !x.isFainted).length;
    const aliveOpponentPokemonNum = this.opponentPokemon.filter(x => !x.isFainted).length;

    if (this.playerActive.isFainted || this.opponentActive.isFainted) {
      // switch only (-> sub tree)
      this.playerChoiceRequest = { canMove: false, canSwitch: this.playerActive.isFainted && alivePlayerPokemonNum >= 1 };
      this.opponentChoiceRequest = { canMove: false, canSwitch: this.opponentActive.isFainted && aliveOpponentPokemonNum >= 1 };
    } else {
      // next turn
      this.playerChoiceRequest = { canMove: true, canSwitch: alivePlayerPokemonNum >= 2 };
      this.opponentChoiceRequest = { canMove: true, canSwitch: aliveOpponentPokemonNum >= 2 };
    }
  }

  isChoicesSubmitted(): boolean {
    const playerMustChoice = this.playerChoiceRequest.canMove || this.playerChoiceRequest.canSwitch;
    const opponentMustChoice = this.opponentChoiceRequest.canMove || this.opponentChoiceRequest.canSwitch;

    const isPlayerSubmitted = !playerMustChoice || !!this.storedPlayerChoice;
    const isOpponentSubmitted = !opponentMustChoice || !!this.storedOpponentChoice;

    return isPlayerSubmitted && isOpponentSubmitted;
  }

  clone(): DamageRaceState {
    const obj = new DamageRaceState(this.damageMatchupsPlayer, this.damageMatchupsOpponent, 
      this.playerPokemon.map(x => x.pokemonStrategy), this.opponentPokemon.map(x => x.pokemonStrategy));
    // obj.damageMatchupsOpponent = this.damageMatchupsPlayer;
    // obj.damageMatchupsOpponent = this.damageMatchupsOpponent;
    
    const playerActiveSlot = this.playerPokemon.indexOf(this.playerActive);
    const opponentActiveSlot = this.opponentPokemon.indexOf(this.opponentActive);
    
    // const obj: DamageRaceState = JSON.parse(JSON.stringify(this));
    // obj.playerActive = obj.playerPokemon[playerActiveSlot];
    // obj.opponentActive = obj.opponentPokemon[opponentActiveSlot];    

    obj.playerPokemon = this.playerPokemon.map(x => ({ ...x }));
    obj.opponentPokemon = this.opponentPokemon.map(x => ({...x}));
    obj.playerActive = obj.playerPokemon[playerActiveSlot];
    obj.opponentActive = obj.opponentPokemon[opponentActiveSlot];    

    obj.playerChoiceRequest = Object.assign({}, this.playerChoiceRequest);
    obj.opponentChoiceRequest = Object.assign({}, this.opponentChoiceRequest);

    obj.storedPlayerChoice = null;
    if (this.storedPlayerChoice) {
      obj.storedPlayerChoice = Object.assign({}, this.storedPlayerChoice);
    }

    obj.storedOpponentChoice = null;
    if (this.storedOpponentChoice) {
      obj.storedOpponentChoice = Object.assign({}, this.storedOpponentChoice);
    }

    obj.isChoicesReady = this.isChoicesReady;

    return obj;
  }

  toString(): string {
    const pa = this.playerActive;
    const oa = this.opponentActive;

    // not all texts are injected
    return (`
      Turn: -1\n
      \n
      Weather: None\n
      PsuedoWeathers: []\n
      \n
      botPlayer\n
      \tRequest Type: Any Move\n
      Active Pokemon: ${pa.pokemonStrategy.species} ${(pa.hpRatio).toFixed(0)}/100 @ ${pa.pokemonStrategy.item}, L50.  Ability: stancechange.  Volatiles: []  Boosts: {\"spd\":-1}  Stats: {\"atk\":161,\"def\":70,\"spa\":211,\"spd\":70,\"spe\":72,\"hp\":167}. I'm Active!\n
      \tAll Pokemon:\n
      \t\tAegislash 167/167 @ weaknesspolicy, L50.  Ability: stancechange.  Volatiles: []  Boosts: {\"spd\":-1}  Stats: {\"atk\":161,\"def\":70,\"spa\":211,\"spd\":70,\"spe\":72,\"hp\":167}. I'm Active!\n
      \tside conditions:[]\n
      \n
      humanPlayer\n
      \tRequest Type: Any Move\n
      \tactive:${oa.pokemonStrategy.species} ${(oa.hpRatio).toFixed(0)}/100 @ ${oa.pokemonStrategy.item}, L50.  Ability: mirrorarmor.  Volatiles: []  Boosts: {}  Stats: {\"atk\":107,\"def\":172,\"spa\":65,\"spd\":105,\"spe\":88,\"hp\":205}. I'm Active!\n
      \tAll Pokemon:\n
      \t\tCorviknight 118/205 @ leftovers, L50.  Ability: mirrorarmor.  Volatiles: []  Boosts: {}  Stats: {\"atk\":107,\"def\":172,\"spa\":65,\"spd\":105,\"spe\":88,\"hp\":205}. I'm Active!\n
      \tside conditions:[]\n
      \n
      \n
      {\n
        \"p1_reflect\": 0,\n
        \"p2_reflect\": 0,\n
        \"p1_spikes\": 0,\n
        \"p2_spikes\": 0,\n
        \"p1_stealthrock\": 0,\n
        \"p2_stealthrock\": 0,\n
        \"p1_stickyweb\": 0,\n
        \"p2_stickyweb\": 0,\n
        \"p1_toxicspikes\": 0,\n
        \"p2_toxicspikes\": 0,\n
        \"p1_lightscreen\": 0,\n
        \"p2_lightscreen\": 0,\n
        \"p1_tailwind\": 0,\n
        \"p2_tailwind\": 0,\n
        \"p1_substitute\": 0,\n
        \"p2_substitute\": 0,\n
        \"p1_confusion\": 0,\n
        \"p2_confusion\": 0,\n
        \"p1_leechseed\": 0,\n
        \"p2_leechseed\": 0,\n
        \"p1_infestation\": 0,\n
        \"p2_infestation\": 0,\n
        \"p1_atk\": 0,\n
        \"p2_atk\": 0,\n
        \"p1_def\": 0,\n
        \"p2_def\": 0,\n
        \"p1_spa\": 0,\n
        \"p2_spa\": 0,\n
        \"p1_spd\": -1,\n
        \"p2_spd\": 0,\n
        \"p1_spe\": 0,\n
        \"p2_spe\": 0,\n
        \"p1_accuracy\": 0,\n
        \"p2_accuracy\": 0,\n
        \"p1_evasion\": 0,\n
        \"p2_evasion\": 0,\n
        \"p1_hp\": 1,\n
        \"p2_hp\": 0.5756097560975609,\n
        \"p1_alive\": 1,\n
        \"p2_alive\": 1,\n
        \"p1_fast_alive\": 0,\n
        \"p2_fast_alive\": 0,\n
        \"p1_psn_count\": 0,\n
        \"p2_psn_count\": 0,\n
        \"p1_tox_count\": 0,\n
        \"p2_tox_count\": 0,\n
        \"p1_slp_count\": 0,\n
        \"p2_slp_count\": 0,\n
        \"p1_brn_count\": 0,\n
        \"p2_brn_count\": 0,\n
        \"p1_frz_count\": 0,\n
        \"p2_frz_count\": 0,\n
        \"p1_par_count\": 0,\n
        \"p2_par_count\": 0,\n
        \"items\": 1,\n
        \"faster\": 0,\n
        \"has_supereffective\": 0,\n
        \"has_stab\": 1\n
      }`
    );
  }
}
