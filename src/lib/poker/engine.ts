import { Card, buildDeck, shuffle } from "../cards";
import { PokerLobbySettings } from "../games/registry";
import { compareHands, evaluateBestHand, EvaluatedHand } from "./hand";

export type Street = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown" | "finished";

export type PlayerPublic = {
  id: string;
  name: string;
  avatarId: string;
  seat: number;
  stack: number;
  bet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  sittingOut: boolean;
  busted: boolean;
  holeCount: number;
  /** Revealed at showdown */
  hole?: Card[];
  handName?: string;
};

export type PokerPublicState = {
  status: Street;
  handNumber: number;
  dealerSeat: number;
  actingSeat: number | null;
  board: Card[];
  pot: number;
  sidePots: { amount: number; eligible: string[] }[];
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  blindLevel: number;
  turnEndsAt: number | null;
  turnTimerSec: number;
  players: PlayerPublic[];
  winners?: { id: string; amount: number; handName?: string }[];
  placements?: { id: string; name: string; avatarId: string; place: number }[];
  lastAction?: string;
  message?: string;
};

export type PokerPrivateView = PokerPublicState & {
  myHole: Card[];
  legal: {
    canFold: boolean;
    canCheck: boolean;
    canCall: boolean;
    callAmount: number;
    canRaise: boolean;
    minRaiseTo: number;
    maxRaiseTo: number;
  };
};

type InternalPlayer = {
  id: string;
  name: string;
  avatarId: string;
  seat: number;
  stack: number;
  bet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  busted: boolean;
  hole: Card[];
  placement: number | null;
};

export type PokerEngineConfig = PokerLobbySettings & {
  players: { id: string; name: string; avatarId: string }[];
};

function blindForLevel(startingSB: number, level: number) {
  // Double every level after 1
  const sb = startingSB * Math.pow(2, Math.max(0, level - 1));
  return { smallBlind: sb, bigBlind: sb * 2 };
}

export class PokerEngine {
  settings: PokerLobbySettings;
  players: InternalPlayer[] = [];
  status: Street = "waiting";
  handNumber = 0;
  dealerSeat = 0;
  actingSeat: number | null = null;
  board: Card[] = [];
  deck: Card[] = [];
  pot = 0;
  currentBet = 0;
  minRaise = 0;
  smallBlind = 0;
  bigBlind = 0;
  blindLevel = 1;
  turnEndsAt: number | null = null;
  lastAction = "";
  message = "";
  winners: { id: string; amount: number; handName?: string }[] = [];
  private lastAggressorSeat: number | null = null;
  private actedThisRound = new Set<string>();

  constructor(config: PokerEngineConfig) {
    this.settings = {
      lobbyName: config.lobbyName,
      startingStack: config.startingStack,
      maxPlayers: config.maxPlayers,
      turnTimerSec: config.turnTimerSec,
      startingSmallBlind: config.startingSmallBlind,
      blindIntervalMin: config.blindIntervalMin,
      blindPreset: config.blindPreset,
    };
    this.players = config.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      seat: i,
      stack: config.startingStack,
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      busted: false,
      hole: [],
      placement: null,
    }));
    const blinds = blindForLevel(this.settings.startingSmallBlind, 1);
    this.smallBlind = blinds.smallBlind;
    this.bigBlind = blinds.bigBlind;
    this.minRaise = this.bigBlind;
  }

  activePlayers() {
    return this.players.filter((p) => !p.busted);
  }

  inHandPlayers() {
    return this.players.filter((p) => !p.busted && !p.folded);
  }

  canActPlayers() {
    return this.players.filter((p) => !p.busted && !p.folded && !p.allIn && p.stack > 0);
  }

  startHand(now = Date.now()) {
    if (this.activePlayers().length < 2) {
      this.finishTournament();
      return;
    }
    this.handNumber += 1;
    this.board = [];
    this.pot = 0;
    this.winners = [];
    this.deck = shuffle(buildDeck());
    this.actedThisRound.clear();
    this.lastAggressorSeat = null;
    this.message = `Hand #${this.handNumber}`;

    for (const p of this.players) {
      p.bet = 0;
      p.totalBet = 0;
      p.folded = p.busted;
      p.allIn = false;
      p.hole = [];
    }

    // Move dealer among active
    this.dealerSeat = this.nextActiveSeat(this.dealerSeat);
    const blinds = blindForLevel(this.settings.startingSmallBlind, this.blindLevel);
    this.smallBlind = blinds.smallBlind;
    this.bigBlind = blinds.bigBlind;
    this.minRaise = this.bigBlind;
    this.currentBet = 0;

    // Deal hole cards
    for (let r = 0; r < 2; r++) {
      for (const p of this.players) {
        if (p.busted) continue;
        p.hole.push(this.deck.pop()!);
      }
    }

    const active = this.activePlayers();
    if (active.length === 2) {
      // Heads-up: dealer is SB
      this.postBlind(this.dealerSeat, this.smallBlind);
      const bbSeat = this.nextActiveSeat(this.dealerSeat);
      this.postBlind(bbSeat, this.bigBlind);
      this.actingSeat = this.dealerSeat;
    } else {
      const sbSeat = this.nextActiveSeat(this.dealerSeat);
      const bbSeat = this.nextActiveSeat(sbSeat);
      this.postBlind(sbSeat, this.smallBlind);
      this.postBlind(bbSeat, this.bigBlind);
      this.actingSeat = this.nextActiveSeat(bbSeat);
    }

    this.currentBet = Math.max(...this.players.map((p) => p.bet));
    this.status = "preflop";
    this.startTurnTimer(now);
  }

  private postBlind(seat: number, amount: number) {
    const p = this.players.find((x) => x.seat === seat)!;
    const pay = Math.min(amount, p.stack);
    p.stack -= pay;
    p.bet += pay;
    p.totalBet += pay;
    this.pot += pay;
    if (p.stack === 0) p.allIn = true;
    this.lastAction = `${p.name} posts ${pay}`;
  }

  nextActiveSeat(from: number) {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const seat = (from + i) % n;
      const p = this.players.find((x) => x.seat === seat)!;
      if (!p.busted) return seat;
    }
    return from;
  }

  nextToAct(from: number) {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const seat = (from + i) % n;
      const p = this.players.find((x) => x.seat === seat)!;
      if (!p.busted && !p.folded && !p.allIn && p.stack > 0) return seat;
    }
    return null;
  }

  startTurnTimer(now = Date.now()) {
    this.turnEndsAt = now + this.settings.turnTimerSec * 1000;
  }

  clearTurnTimer() {
    this.turnEndsAt = null;
  }

  bumpBlindLevel() {
    this.blindLevel += 1;
    const blinds = blindForLevel(this.settings.startingSmallBlind, this.blindLevel);
    this.smallBlind = blinds.smallBlind;
    this.bigBlind = blinds.bigBlind;
    this.message = `Blinds up: ${this.smallBlind}/${this.bigBlind}`;
  }

  legalActions(playerId: string) {
    const p = this.players.find((x) => x.id === playerId);
    const empty = {
      canFold: false,
      canCheck: false,
      canCall: false,
      callAmount: 0,
      canRaise: false,
      minRaiseTo: 0,
      maxRaiseTo: 0,
    };
    if (!p || this.actingSeat !== p.seat || p.folded || p.allIn || p.busted) {
      return empty;
    }
    const toCall = this.currentBet - p.bet;
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && p.stack > 0;
    const callAmount = Math.min(toCall, p.stack);
    const minRaiseTo = this.currentBet + this.minRaise;
    const maxRaiseTo = p.bet + p.stack;
    const canRaise = p.stack > toCall && maxRaiseTo > this.currentBet;
    return {
      canFold: true,
      canCheck,
      canCall,
      callAmount,
      canRaise,
      minRaiseTo: Math.min(minRaiseTo, maxRaiseTo),
      maxRaiseTo,
    };
  }

  applyAction(
    playerId: string,
    action: "fold" | "check" | "call" | "raise" | "timeout",
    raiseTo?: number,
    now = Date.now(),
  ) {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || this.actingSeat !== p.seat) return;

    if (action === "timeout") {
      const legal = this.legalActions(playerId);
      action = legal.canCheck ? "check" : "fold";
    }

    if (action === "fold") {
      p.folded = true;
      this.lastAction = `${p.name} folds`;
      this.actedThisRound.add(p.id);
    } else if (action === "check") {
      if (this.currentBet !== p.bet) return;
      this.lastAction = `${p.name} checks`;
      this.actedThisRound.add(p.id);
    } else if (action === "call") {
      const toCall = this.currentBet - p.bet;
      const pay = Math.min(toCall, p.stack);
      p.stack -= pay;
      p.bet += pay;
      p.totalBet += pay;
      this.pot += pay;
      if (p.stack === 0) p.allIn = true;
      this.lastAction = `${p.name} calls ${pay}`;
      this.actedThisRound.add(p.id);
    } else if (action === "raise") {
      const target = raiseTo ?? this.currentBet + this.minRaise;
      const legal = this.legalActions(playerId);
      const raiseToClamped = Math.max(
        legal.minRaiseTo,
        Math.min(target, legal.maxRaiseTo),
      );
      const pay = raiseToClamped - p.bet;
      if (pay <= 0 || pay > p.stack) return;
      const raiseSize = raiseToClamped - this.currentBet;
      p.stack -= pay;
      p.bet += pay;
      p.totalBet += pay;
      this.pot += pay;
      if (raiseSize > 0) {
        this.minRaise = Math.max(this.minRaise, raiseSize);
      }
      this.currentBet = p.bet;
      this.lastAggressorSeat = p.seat;
      this.actedThisRound = new Set([p.id]);
      if (p.stack === 0) p.allIn = true;
      this.lastAction = `${p.name} raises to ${p.bet}`;
    }

    // Everyone folded?
    const remaining = this.inHandPlayers();
    if (remaining.length === 1) {
      this.awardToWinner(remaining[0], now);
      return;
    }

    this.advanceAfterAction(now);
  }

  private awardToWinner(winner: InternalPlayer, _now: number) {
    // Commit any street bets already in pot; also rake current bets into pot
    for (const p of this.players) {
      // bets already added to pot during actions
      p.bet = 0;
    }
    winner.stack += this.pot;
    this.winners = [{ id: winner.id, amount: this.pot }];
    this.lastAction = `${winner.name} wins ${this.pot}`;
    this.message = `${winner.name} wins the hand`;
    this.pot = 0;
    this.actingSeat = null;
    this.clearTurnTimer();
    this.status = "waiting";
    this.settleBusts();
  }

  private advanceAfterAction(now: number) {
    const canAct = this.canActPlayers();
    const bettingDone =
      canAct.length === 0 ||
      canAct.every(
        (p) =>
          this.actedThisRound.has(p.id) &&
          (p.bet === this.currentBet || p.allIn || p.stack === 0),
      );

    if (!bettingDone) {
      const next = this.nextToAct(this.actingSeat!);
      this.actingSeat = next;
      this.startTurnTimer(now);
      return;
    }

    this.collectBetsToPot();
    this.progressStreet(now);
  }

  private collectBetsToPot() {
    for (const p of this.players) {
      p.bet = 0;
    }
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.actedThisRound.clear();
    this.lastAggressorSeat = null;
  }

  private progressStreet(now: number) {
    const canAct = this.canActPlayers();
    if (canAct.length <= 1 && this.inHandPlayers().every((p) => p.allIn || p.folded || canAct[0]?.id === p.id || p.stack === 0)) {
      // Run out board if needed
      this.runOutBoard();
      this.showdown(now);
      return;
    }

    if (this.status === "preflop") {
      this.deck.pop(); // burn
      this.board.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
      this.status = "flop";
    } else if (this.status === "flop") {
      this.deck.pop();
      this.board.push(this.deck.pop()!);
      this.status = "turn";
    } else if (this.status === "turn") {
      this.deck.pop();
      this.board.push(this.deck.pop()!);
      this.status = "river";
    } else if (this.status === "river") {
      this.showdown(now);
      return;
    }

    // First to act: left of dealer
    this.actingSeat = this.nextToAct(this.dealerSeat);
    if (this.actingSeat === null) {
      this.runOutBoard();
      this.showdown(now);
      return;
    }
    this.startTurnTimer(now);
  }

  private runOutBoard() {
    while (this.board.length < 5) {
      this.deck.pop(); // burn approximate
      this.board.push(this.deck.pop()!);
    }
  }

  private showdown(now: number) {
    this.status = "showdown";
    this.actingSeat = null;
    this.clearTurnTimer();
    const contenders = this.inHandPlayers();
    const evals = new Map<string, EvaluatedHand>();
    for (const p of contenders) {
      evals.set(p.id, evaluateBestHand(p.hole, this.board));
    }

    // Side pots by contribution
    const pots = this.computeSidePots(contenders.map((p) => p.id));
    const awards: { id: string; amount: number; handName?: string }[] = [];

    for (const pot of pots) {
      const eligible = pot.eligible
        .map((id) => this.players.find((p) => p.id === id)!)
        .filter((p) => !p.folded);
      if (eligible.length === 0) continue;
      let best = evals.get(eligible[0].id)!;
      let winners = [eligible[0]];
      for (let i = 1; i < eligible.length; i++) {
        const ev = evals.get(eligible[i].id)!;
        const cmp = compareHands(ev, best);
        if (cmp > 0) {
          best = ev;
          winners = [eligible[i]];
        } else if (cmp === 0) {
          winners.push(eligible[i]);
        }
      }
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      for (const w of winners) {
        let amt = share;
        if (remainder > 0) {
          amt += 1;
          remainder -= 1;
        }
        w.stack += amt;
        awards.push({
          id: w.id,
          amount: amt,
          handName: best.name,
        });
      }
    }

    this.winners = awards;
    this.pot = 0;
    this.message = "Showdown";
    // Mark busts after short delay handled by room; here immediately settle
    this.settleBusts();
  }

  /** Approximate side pots from totalBet this hand */
  private computeSidePots(eligibleIds: string[]) {
    const contrib = this.players
      .filter((p) => p.totalBet > 0)
      .map((p) => ({ id: p.id, amount: p.totalBet, folded: p.folded }))
      .sort((a, b) => a.amount - b.amount);

    if (contrib.length === 0) return [{ amount: this.pot, eligible: eligibleIds }];

    const levels = [...new Set(contrib.map((c) => c.amount))];
    const pots: { amount: number; eligible: string[] }[] = [];
    let prev = 0;
    for (const level of levels) {
      const involved = contrib.filter((c) => c.amount >= level);
      const amount = (level - prev) * involved.length;
      const eligible = involved.filter((c) => !c.folded).map((c) => c.id);
      if (amount > 0) pots.push({ amount, eligible: eligible.length ? eligible : involved.map((c) => c.id) });
      prev = level;
    }
    // If floating pot mismatch, dump remainder into main
    const sum = pots.reduce((s, p) => s + p.amount, 0);
    if (sum < this.pot && pots.length) {
      pots[pots.length - 1].amount += this.pot - sum;
    }
    return pots.length ? pots : [{ amount: this.pot, eligible: eligibleIds }];
  }

  settleBusts() {
    const justBusted = this.players.filter((p) => !p.busted && p.stack === 0);
    justBusted.sort((a, b) => a.seat - b.seat);
    // Next placement = remaining alive after this settlement + 1
    let nextPlace =
      this.players.filter((p) => !p.busted && p.stack > 0).length + 1;
    for (const p of justBusted) {
      p.busted = true;
      p.placement = nextPlace;
      nextPlace += 1;
    }

    if (this.players.filter((p) => !p.busted).length <= 1) {
      this.finishTournament();
    } else {
      this.status = "waiting";
      this.actingSeat = null;
    }
  }

  finishTournament() {
    this.status = "finished";
    this.actingSeat = null;
    this.clearTurnTimer();
    const alive = this.players.filter((p) => !p.busted);
    if (alive.length === 1) {
      alive[0].placement = 1;
    }
    // Fill any missing placements
    const placed = this.players.filter((p) => p.placement !== null);
    let next = this.players.length;
    for (const p of this.players) {
      if (p.placement === null) {
        p.placement = next;
        next -= 1;
      }
    }
    this.message = "Tournament finished";
    void placed;
  }

  getPlacements() {
    return [...this.players]
      .filter((p) => p.placement !== null)
      .sort((a, b) => a.placement! - b.placement!)
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
        place: p.placement!,
        stack: p.stack,
      }));
  }

  tick(now = Date.now()) {
    if (
      this.turnEndsAt &&
      this.actingSeat !== null &&
      now >= this.turnEndsAt &&
      this.status !== "showdown" &&
      this.status !== "finished" &&
      this.status !== "waiting"
    ) {
      const p = this.players.find((x) => x.seat === this.actingSeat);
      if (p) this.applyAction(p.id, "timeout", undefined, now);
    }
  }

  toPublic(): PokerPublicState {
    return {
      status: this.status,
      handNumber: this.handNumber,
      dealerSeat: this.dealerSeat,
      actingSeat: this.actingSeat,
      board: this.board,
      pot: this.pot,
      sidePots: [],
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      blindLevel: this.blindLevel,
      turnEndsAt: this.turnEndsAt,
      turnTimerSec: this.settings.turnTimerSec,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
        seat: p.seat,
        stack: p.stack,
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        sittingOut: false,
        busted: p.busted,
        holeCount: p.hole.length,
        hole:
          this.status === "showdown" || this.status === "finished"
            ? !p.folded && !p.busted
              ? p.hole
              : undefined
            : undefined,
        handName:
          this.status === "showdown" && p.hole.length === 2 && !p.folded
            ? evaluateBestHand(p.hole, this.board).name
            : undefined,
      })),
      winners: this.winners.length ? this.winners : undefined,
      placements:
        this.status === "finished" ? this.getPlacements() : undefined,
      lastAction: this.lastAction,
      message: this.message,
    };
  }

  toPrivate(playerId: string): PokerPrivateView {
    const pub = this.toPublic();
    const me = this.players.find((p) => p.id === playerId);
    return {
      ...pub,
      players: pub.players.map((p) => {
        if (p.id === playerId && me) {
          return { ...p, hole: me.hole };
        }
        return p;
      }),
      myHole: me?.hole ?? [],
      legal: this.legalActions(playerId),
    };
  }
}
