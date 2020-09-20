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
  switchTo?: number
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

  storedPlayerChoice: DamageRaceChoice;
  storedOpponentChoice: DamageRaceChoice;
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
      choices.push({ type: 0, moveSlot: 0, moveName: active.pokemonStrategy.move1});
      choices.push({ type: 0, moveSlot: 1, moveName: active.pokemonStrategy.move2});
      choices.push({ type: 0, moveSlot: 2, moveName: active.pokemonStrategy.move3});
      choices.push({ type: 0, moveSlot: 3, moveName: active.pokemonStrategy.move4});
    }

    if (request.canSwitch) {
      const alivePokemonindices = pokemon.map((x, i) => ({poke: x, i: i}))
      .filter((x) => !x.poke.isFainted)
      .map(x => x.i);

      alivePokemonindices.forEach(x => choices.push({ type: 1, switchTo: x}));
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

  processSwitchPhase(playerChoice: DamageRaceChoice, opponentChoice: DamageRaceChoice): boolean {
    // todo: speed priorities

    if (playerChoice.type === 0) {
      // this.playerActiveSlot = playerChoice.switchTo;
      this.playerActive = this.playerPokemon[playerChoice.switchTo];
      this.storedPlayerChoice = null;
    }

    if (opponentChoice.type === 0) {
      // this.opponentActiveSlot = opponentChoice.switchTo;
      this.opponentActive = this.opponentPokemon[opponentChoice.switchTo];
      this.storedOpponentChoice = null;
    }

    return true;
  }

  processMovePhase(): boolean {
    // todo: speed priorities

    this.processMoveChoice(this.storedOpponentChoice, this.damageMatchupsPlayer, this.playerActive, this.opponentActive);
    this.storedPlayerChoice = null;

    this.processMoveChoice(this.storedPlayerChoice, this.damageMatchupsOpponent, this.opponentActive, this.playerActive);
    this.storedOpponentChoice = null;

    return true;
  }

  processMoveChoice(choice: DamageRaceChoice, matchups: DamageMatchup[], playerActive: DamageRacePokemon, opponentActive: DamageRacePokemon, ): boolean {
    if (choice.type === 1) {
      this.storedPlayerChoice = null;
      if (this.playerActive.isFainted || this.opponentActive.isFainted) {
        return true;
      }

      const damageMatchupPToO = matchups.find(x => 
        (x.playerPoke.id === playerActive.pokemonStrategy.id) && (x.targetPoke.id === opponentActive.pokemonStrategy.id));
      if (!damageMatchupPToO) {
        throw new Error('Error: corresponding damage matchup was not found');
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
    }

    return true;
  }

  processAfterMoveRequest(): void {
    if (this.playerActive.isFainted) {
      // this.playerActive = null;
      this.playerChoiceRequest = { canMove: false, canSwitch: true };
    }

    if (this.opponentActive.isFainted) {
      // this.opponentActive = null;
      this.opponentChoiceRequest = { canMove: false, canSwitch: true };
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
    // let obj = new DamageRaceState();
    // obj.damageMatchupsOpponent = this.damageMatchupsPlayer;
    // obj.damageMatchupsOpponent = this.damageMatchupsOpponent;
    
    const playerActiveSlot = this.playerPokemon.indexOf(this.playerActive);
    const opponentActiveSlot = this.opponentPokemon.indexOf(this.opponentActive);
    
    const obj: DamageRaceState = JSON.parse(JSON.stringify(this));
    obj.playerActive = obj.playerPokemon[playerActiveSlot];
    obj.opponentActive = obj.opponentPokemon[opponentActiveSlot];    

    return obj;
  }
}
