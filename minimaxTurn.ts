export type DecisionTreeRoot = {
    type: string, // e.g. 'move', my best choice
    id: string, // my best choice
    priority: number // my best choice
    tree: DecisionTree,
}

export type DecisionTree = {
    type: string, //e.g. 'max'
    value: number, // maximum or minimum value of children
    depth: number, // remaining depth (0 on the bottom)
    choices: ChoiceDetail[], // possible choices for the next turn
    children: DecisionTree[], // e.g. children[2] is the next turn after executing choices[2]
    action: ChoiceDetail | null, // best (max or min) choice of this tree (for the next turn)
    state: string // current state of this turn
}

export type ChoiceDetail = {
    type: string, // e.g. 'move'
    id: string,
    priority: number    
}

export interface GameState<T> {
    playerChoices(): T[];
    opponentChoices(): T[];
    staticEvaluateValue(): number;
    executePlayerChoice(choice: T | null): void;
    executeOpponentChoice(choice: T | null): void;
    clone(): GameState<T>;
    isSubTree(): boolean;
    isEnd(): boolean;
    toString(): string;
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

  evaluateTree(restDepth: number): DecisionTree
  {
      if(this.isSubTree)
      {
          restDepth++;
      }

      if(restDepth === 0 || this.isEnd)
      {
          const value = this.staticEvaluateValue();
          return { 
              type: 'max',
              value: value,
              depth: restDepth,
              choices: [],
              children: [],
              action: null,
              state: this.gameState.toString()
          };
      }

      else
      {
          if(this.canOnlyFoeMove())
          {
            const children = this.treesOfFoesChoices(null, restDepth);
            const turnEvalValue = this.decisionTreeMapper('min', this.foesValidChoices, children, restDepth);
            return turnEvalValue;
        }

          else
          {
            const children = this.treesOfMyChoices(restDepth);
            const turnEvalValue = this.decisionTreeMapper('max', this.myValidChoices, children, restDepth);
            return turnEvalValue;
        }
      }
  }

  nextTurn(my: T | null, foes: T | null): MinimaxTurn<T> {
    const newGameState = this.gameState.clone();
    newGameState.executePlayerChoice(my);
    newGameState.executeOpponentChoice(foes);
     
    const newTurn = new MinimaxTurn<T>(newGameState, newGameState.isSubTree(), newGameState.isEnd());
    return newTurn;
  }

  staticEvaluateValue(): number {
      return this.gameState.staticEvaluateValue();
  }

  treesOfMyChoices(restDepth: number): DecisionTree[] {
    const trees: DecisionTree[] = [];

    let currentMax = -1;
    for(let i = 0; i < this.myValidChoices.length; i++)
    {
        const myChoice = this.myValidChoices[i];
        if(this.canOnlyIMove()) //相手の選択肢が存在しない(自分だけが行動する)
        {
            const next = this.nextTurn(myChoice, null);
            const evalTree = next.evaluateTree(restDepth - 1);
            trees.push(evalTree);
        }
        else
        {
            const children = this.treesOfFoesChoices(myChoice, restDepth, currentMax);
            const evalTree = this.decisionTreeMapper('min', this.foesValidChoices, children, restDepth);
            if(i == 0 || evalTree.value > currentMax)
            {
                currentMax = evalTree.value;
            }
            trees.push(evalTree);
        }
    }

    return trees;
  }

  // return: decisionTree[2] is the state after the foes choices[2]
  treesOfFoesChoices(myChoice: T | null, restDepth: number, currentMax = -1): DecisionTree[] {
    let minimumEvalValue: number = Number.MAX_SAFE_INTEGER;
    const trees: DecisionTree[] = [];

    for(let i = 0; i < this.foesValidChoices.length; i++)
    {
        const foesChoice = this.foesValidChoices[i];
        const next = this.nextTurn(myChoice, foesChoice);
        const evalTree = next.evaluateTree(restDepth - 1);
        trees.push(evalTree);

        if(i == 0 || evalTree.value < minimumEvalValue)
        {
            minimumEvalValue = evalTree.value;
        }

        if(minimumEvalValue <= currentMax)
        {
            break;
        }
    }

    return trees;
  }

  //自分の最善手
  executeMinimax(maxDepth: number): DecisionTreeRoot
  {
      if(this.myValidChoices.length == 0)
      {
          throw "この局面に自分の選択肢は存在しません。";
      }

      const trees = this.treesOfMyChoices(maxDepth);
      const tree = this.decisionTreeMapper('max', this.myValidChoices, trees, maxDepth);

      if (!tree.action) {
        throw new Error('Error: tree action is not defined')
      }

      const treeRoot = {
          type: tree.action.type,
          id: tree.action.id,
          priority: tree.action.priority,
          tree: tree
      }

      return treeRoot;
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

  decisionTreeMapper(type: string, validChoices: T[], children: DecisionTree[], restDepth: number): DecisionTree {
    let bestChoiceIndex = -1;

    if (type === 'max') {
        bestChoiceIndex = this.maximumIndex(children.map(x => x.value));
    } else if (type === 'min') {
        bestChoiceIndex = this.minimumIndex(children.map(x => x.value));
    } else {
        throw new Error('Error: invalid tree type');
    }

    // to be improved
    const choiceDetails = validChoices.map((x, i) => ({ type: 'move', id: i.toString(), priority: -1 }));

    const evalTree = {
        type: type,
        value: children[bestChoiceIndex].value,
        depth: restDepth,
        choices: choiceDetails,
        children: children,
        action: choiceDetails[bestChoiceIndex],
        state: this.gameState.toString()
    }

    return evalTree;
  }
} 