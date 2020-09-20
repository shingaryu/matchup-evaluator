
export type MinimaxResult  = {
  evalValuesOfChoices: number[],
  bestChoiceIndex: number,
  bestChoiceEvalValue: number;
}

export interface GameState<T> {
    playerChoices(): T[];
    opponentChoices(): T[];
    staticEvaluateValue(): number;
    executePlayerChoice(choice: T);
    executeOpponentChoice(choice: T);
    clone(): GameState<T>;
    isSubTree(): boolean;
    isEnd(): boolean;
}

export class MinimaxTurn<T> {
  protected isSubTree: boolean;
  protected isEnd: boolean;
  protected gameState: GameState<T>;

  //その局面で有効な選択肢全て。片方は要素が存在しないこともあるので注意
//   protected myValidChoices: DamageRaceChoice[];
//   protected foesValidChoices: DamageRaceChoice[];
  protected myValidChoices: T[];
  protected foesValidChoices: T[];

    constructor(gameState: GameState<T>, isSubTree = false, isEnd = false) {
        this.isSubTree = isSubTree;
        this.gameState = gameState;
        this.isEnd = isEnd;
        this.myValidChoices = this.gameState.playerChoices();
        this.foesValidChoices = this.gameState.opponentChoices();
    }

  canOnlyIMove(): boolean
  {
      return this.gameState.opponentChoices().length === 0;
  }

  canOnlyFoeMove(): boolean
  {
      return this.gameState.playerChoices().length === 0;
  }

  evaluateValue(restDepth: number): number
  {
      if(this.isSubTree)
      {
          restDepth++;
      }

      if(restDepth === 0 || this.isEnd)
      {
          const value = this.staticEvaluateValue();
          return value;
      }

      else
      {
          let turnEvalValue = 0.0;

          if(this.canOnlyFoeMove())
          {
              turnEvalValue = this.minimumValueOfFoesChoices(null, restDepth);
          }

          else
          {
              turnEvalValue = this.maximum(this.valuesOfMyChoices(restDepth));
          }

          return turnEvalValue;
      }
  }

  nextTurn(my: T, foes: T): MinimaxTurn<T> {
    const newGameState = this.gameState.clone();
    newGameState.executePlayerChoice(my);
    newGameState.executeOpponentChoice(foes);
     
    const newTurn = new MinimaxTurn<T>(newGameState, newGameState.isSubTree(), newGameState.isEnd());
    return newTurn;
  }

  staticEvaluateValue(): number {
      return this.gameState.staticEvaluateValue();
  }
  
  //積算あり
  totalValuesOfMyChoices(restDepth: number, nexCount: number): number[]
  {
      if(nexCount === 1)
      {
          return this.valuesOfMyChoices(restDepth);
      }

      let summationValues: number[];
      for(let i = 0; i < this.myValidChoices.length; i++)
      {
          summationValues.push(0.0);
      }

      for(let i = 0; i < nexCount; i++)
      {
          const choiceValues = this.valuesOfMyChoices(restDepth);
          for(let j = 0; j < choiceValues.length; j++)
          {
              summationValues[j] += choiceValues[j] / nexCount;
          }
      }

      return summationValues;
  }

  //自分の選択肢全ての評価値を配列で返す
  valuesOfMyChoices(restDepth: number): number[]
  {
      let values: number[];
      let currentMax = -1;
      for(let i = 0; i < this.myValidChoices.length; i++)
      {
          const myChoice = this.myValidChoices[i];
          let evalValue = 0.0;
          if(this.canOnlyIMove()) //相手の選択肢が存在しない(自分だけが行動する)
          {
              const next = this.nextTurn(myChoice, null);
              evalValue = next.evaluateValue(restDepth - 1);
          }
          else
          {
              evalValue = this.minimumValueOfFoesChoices(myChoice, restDepth, currentMax);
              if(i == 0 || evalValue > currentMax)
              {
                  currentMax = evalValue;
              }
          }

          values.push(evalValue);
      }

      return values;
  }

  minimumValueOfFoesChoices(myChoice: T, restDepth: number, currentMax = -1): number
  {
      let minimumEvalValue: number = Number.MAX_SAFE_INTEGER;

      for(let i = 0; i < this.foesValidChoices.length; i++)
      {
          const foesChoice = this.foesValidChoices[i];
          const next = this.nextTurn(myChoice, foesChoice);
          const evalValue = next.evaluateValue(restDepth - 1);

          if(i == 0 || evalValue < minimumEvalValue)
          {
              minimumEvalValue = evalValue;
          }

          if(minimumEvalValue <= currentMax)
          {
              break;
          }
      }

      return minimumEvalValue;
  }


  //自分の最善手
  executeMinimax(maxDepth: number, nex = 1): MinimaxResult
  {
      if(this.myValidChoices.length == 0)
      {
          throw "この局面に自分の選択肢は存在しません。";
      }

      const result: any = {};
      const values = this.totalValuesOfMyChoices(maxDepth, nex);
      result.evalValuesOfChoices = values;

      //
      // 勝ちを表す評価値が含まれている場合、決まり手が存在する可能性があるので探索
      //
      if(maxDepth > 1 && values.indexOf(10) >= 0)
      {
          const index = this.finishingChoiceIndex(nex);
          if(index != -1)
          {
              result.bestChoiceIndex = index;
              result.bestChoiceEvalValue = 10.0;
              return result;
          }
      }

      const index = this.maximumIndex(values);
      result.bestChoiceIndex = index;
      result.bestChoiceEvalValue = values[index];
      return result;
  }

  //決まり手が存在すればそのインデックス、なければ-1
  finishingChoiceIndex(nex = 1): number
  {
      if(this.myValidChoices.length == 0)
      {
          throw "この局面に自分の選択肢は存在しません。";
      }

      const values = this.totalValuesOfMyChoices(1, nex);
      const index = values.indexOf(10);
      return index;
  }

  average(list: number[]): number {
    if(list.length === 0)
    {
        throw "平均を求める値のリストが空です。";
    }

    let sum = 0;
    list.forEach(x => sum += x);

    return sum / list.length;
  }

  maximum(list: number[]): number {
    if(list.length === 0)
    {
        throw "最大値を求める値のリストが空です。";
    }

    const maximumValue = Math.max(...list);

    return maximumValue;
  }

  minimum(list: number[]): number {
    if(list.length === 0)
    {
        throw "最小値を求める値のリストが空です。";
    }

    const minimumValue = Math.min(...list);

    return minimumValue;
  }


  maximumIndex(array: number[]): number {
    return this.maximumIndexFunc(array, x => x);
  } 

  minimumIndex(array: number[]): number {
    return this.minimumIndexFunc(array, x => x);
  } 

  maximumIndexFunc<T>(array: T[], value: (item: T) => number): number {
    const maximumValue = Math.max(...array.map(x => value(x)));
    const maximumValueIndex = array.findIndex(x => value(x) === maximumValue);
    return maximumValueIndex;
  }
  
  minimumIndexFunc<T>(array: T[], value: (item: T) => number): number {
    const minimumValue = Math.min(...array.map(x => value(x)));
    const minimumValueIndex = array.findIndex(x => value(x) === minimumValue);
    return minimumValueIndex;
  }
} 