# Writing the bindings of one tradition

For the authors who fill in `predicates/bazi.ts`, `predicates/vedic.ts` and `predicates/iching.ts`. Western is bound in the same way, by `predicates/western.ts` and the files of its folder. Each of you edits your one file and any new files beside it (`predicates/bazi/…`, helpers, tables). Nobody edits `types.ts`, `registry.ts`, `evaluate.ts`, `signals.ts`, the data files or another tradition's file. If you think a shared file is wrong, say so; do not change it.

## What you are binding

The JSON under `data/` is the source of truth: one rule is an id, a stage, an exact `condition`, the `inputs` it needs, `topics`, a `direction`, an ordering key `strength` (1 to 3, see below), a sentence `template` with `{slots}`, its source and its `dedupeKey`. A binding is the code that decides when the **condition** holds. Implement the condition as written. Do not invent a rule, a threshold, a sign or a sentence. If a condition is ambiguous or needs something the engine cannot compute, do not guess: leave the rule unbound, list it in `NOT_EVALUATED` with the reason, and report it.

## The interface

```ts
interface RuleBinding {
  ruleId: string;                 // an id from your data file; exactly one binding per rule
  tradition: Tradition;           // must match the file the rule is in
  requires?: { sex?: boolean; birthTime?: boolean };
  levels?: LevelId[];             // the levels this rule can speak at, declared (see "Levels"); 'natal' for undated statements
  periodRead?: true;              // this one rule is read by period (see "Traditions and rules read by period")
  fire(ctx: ForecastContext, rule: Rule): Firing[];   // zero or more times the condition held
}

interface Firing {
  clock: ClockId;                 // 'luck' | 'birthday' | 'dasha' | 'solar-longitude' | 'calendar-year'
                                  // | 'jupiter-tropical' | 'jupiter-sidereal' | 'saturn-tropical' | 'saturn-sidereal'
                                  // | 'moon' | 'mars' | 'venus' | 'mercury' | 'node'
  level?: LevelId;                // only where one clock carries two nested periods; see "Levels" below
  startUtcMs: number | null;      // null on both = natal and undated: context, never part of a slice
  endUtcMs: number | null;
  facts: Fact[];                  // every value that fired it: { key, label, value, unit? }
  topics?: Topic[];               // a subset of rule.topics; default all of them
  direction?: Direction;          // whenever the rule's own text assigns the direction case by case; see below
  dedupeInstance?: string;        // replaces start-end in the dedupe key, for facts not tied to a window
  conventionsUsed?: string[];     // names from ForecastConventions or the engine's Conventions
  badges?: string[];              // extra labels, e.g. 'extension (antardasha)', 'school conflict'
}
```

The framework turns each firing into one signal per topic. The signal's sentence is the rule's `template` with every `{slot}` filled from `facts` by `key` and from nothing else. **A slot without a fact throws** `UnboundSlotError`, and so does a slot in the rule's `dedupeKey` (for example `dasha-house-lord:{planet}`), so give a fact for every slot in both. Fact keys must be unique within a firing. Values are strings or finite numbers.

`fire` must be pure and deterministic: no clock, no randomness, no input or output. Return firings for the whole span of `ctx.input.span`; the framework drops those outside it. Clocks: a clock is the set of instants that set its boundaries. Pick the clock whose boundaries your firing actually follows; luck, birthday and dasha clocks are one independence group, each sky clock is its own, and the tropical and sidereal Jupiter clocks are different clocks. Do not choose a clock to change how agreement counts.

Direction and stage come from the rule; you never alter them, except through `Firing.direction`. A binding sets the direction of a firing whenever the rule's own text assigns the direction case by case: by house (`directionByHouse`), by the reading a sentence names (favourable, difficult, raises, lowers), by the grade of a statement, and so on. The case table is the rule's, not yours, and the binding's test shows it: one row for each case the text names, the facts that select it and the direction it gives. A binding never chooses a direction because the case "looks" good or bad, and never sets one where the text gives a single direction for the whole rule. A rule whose direction is `activates`, or whose stage is `modifier`, never gives a reading its sign.

A rule whose text gives a verdict branch by branch can carry a table `directionByBranch`: for each branch a printed page, a quotation of at most 25 words, and a `direction` only where the page states the verdict in words. A branch without a direction is read as a note without a direction (`Firing.direction = 'activates'`): the binding does not turn "moderate" or "mediocrity" into a word of its own. `branchDirection(rule, branch)` in `predicates/western/natal.ts` reads the table; a binding names the branch it found and nothing else. The directions in the table are part of the ruleset hash; the pages and quotations are not. The two honour rules use it (page 615-616 of Lilly, Book III, Chap. CXLIIII):

- `lilly.career.honour-essential`: in house, exaltation or mutual reception, supports ("Honours, Offices of publick trust, great Commands, exceeding favour"); in triplicity, terms or face, a note ("a mediocrity or indifferency"); peregrine, in detriment or fall without reception, cautions ("very small or no Dignities at all").
- `lilly.career.honour-angularity`: in angles, supports ("ample Preferment"); in succedent houses, a note ("moderate Esteem, or little Honour or Dignity": two readings joined by "or", no verdict chosen between them); in the eighth or cadent houses, cautions ("very little Honour or Reputation", "a meane and obscure condition of life").
- The clauses on planets in the tenth house (fortunate, malevolent, mean planets) are on page 616 and are still not coded.

Two readings in these rules are written down here on purpose, each with its printed page:

1. Where Lilly's page says "mediocrity" (Book III p.615, "a mediocrity or indifferency", for a significator in triplicity, terms or face), the engine shows a note without a direction. The word names a middle state and not a verdict, so no direction is chosen.
2. Where Lilly's page says that a significator that is peregrine, or in detriment or fall without reception, has "very small or no Dignities at all" (Book III p.615), that denial of dignity is read as unfavourable for honour, and the engine shows cautions.

## Levels

A reader is shown techniques, not clocks: the BaZi luck pillar, the BaZi year pillar, the Vedic mahadasha, the Vedic antardasha, Saturn through the signs counted from the natal Moon, Jupiter likewise, the Western annual profection, the firdaria, the solar return, the Western transits (`LEVEL_IDS` in `types.ts`; plain labels in `LEVEL_LABEL` in the phrasebook, which never uses the words clock, stage, gate, dedupe or strength). The level of a signal follows from its tradition and clock (`levels.ts`), so most bindings say nothing. Where one clock carries two or more nested periods the binding must say which one it judged, with `Firing.level`:

- the dasha clock carries the mahadasha (`vedic-maha`) and the antardasha (`vedic-antar`); the Vedic dasha bindings set it from the span they were judging;
- the birthday clock carries the Western annual profection (`western-profection`), the firdaria (`western-firdaria`) and the solar return (`western-solar-return`); the Western bindings, when they are written, must set it.

`levelNeedsField(tradition, clock)` says which clocks need it, `levelFits` says which levels may be set on which clock (a mismatch is a `BadFiringError`), and the registry audit reports a dated firing that omits the field where it is needed. Undated firings are the chart itself and have the level `natal`; set nothing. Do not choose a level to change how a reading reads: the word of a level reading is the same word rule as for a tradition, with the plain counts printed beside it.

**Every binding declares the levels its rule can speak at**, in the table at the top of the tradition's module (`LEVELS`, applied with `declareLevels`; a binding without a row, or a row without a binding, is an error at load). The decade grid has a row for every level that has a bound rule for the topic, so a level that never fires in a span is shown silent and not left out; that is why the declaration is static and not read from what fired. A rule that can speak both undated and dated declares `'natal'` as well. A test fires every binding on sample moments and fails if a statement stands on a level its rule did not declare. The topics of a row are the topics of the rules that declare it.

## Traditions and rules read by period

A tradition may be flagged `PERIOD_READ = true` in its module (the I Ching is). Such a tradition is the character of a period, not a statement about a year: its rules are not run when a span is evaluated (so a long span costs nothing for them), its statements never enter a yearly reading, the statement list, the year view, the decade grid or a headline, and it stays out of agreement. A single rule of a tradition that is otherwise read by year can be flagged the same way with `periodRead: true` on its binding (`lilly.transit.daily-cusps`, Lilly's passes of the planets over the angles and radical places, day by day, is). Both are read through `periodCharacter(input, window)` in `period.ts`, for a window of at most 62 days, each tradition in its own part: `iching` (badge "experimental") and `western` (the flagged Western rules, without that badge, with `unavailable` saying why it is empty where the birth time is unknown). Their bindings are still audited, and still run when `includePeriodRead` is passed to `evaluate` (the tests do). A new period-read tradition needs a function of its own that reads a window; the flag alone only keeps it out of the yearly forms.

## What the context gives you

`ForecastContext` (in `context.ts`) computes each piece once, on first use:

| call | gives |
| --- | --- |
| `ctx.input` | moment, engine `Conventions`, `ForecastConventions`, span, birth-time uncertainty |
| `ctx.slices` | the calendar-year slices of the span |
| `ctx.sex` | `'male' \| 'female' \| null`, from `baziSexConvention` |
| `ctx.pillars()` | the four pillars |
| `ctx.luck()` | luck pillars, or **null without a sex convention** (their direction needs it) |
| `ctx.annualPillars()` | annual pillars over the span |
| `ctx.chart()` | the tropical chart |
| `ctx.siderealChart()` | Lagna and Sun to Saturn, Rahu, Ketu with sidereal sign, degree and whole-sign house |
| `ctx.dashas()` | Vimshottari `maha` and `antar` spans |
| `ctx.ingresses(planet, frame)` | sign-stay spans of a planet, `'tropical'` or `'sidereal'` |
| `ctx.guaQi()` | gua qi hexagram periods under the engine's `guaQi` convention |
| `ctx.sovereign()` | sovereign hexagram periods under the engine's `sovereignBoundary` convention |
| `ctx.memo(key, compute)` | compute anything else once; the key must say everything the value depends on |
| `ctx.extension<T>('bazi')` | what your own context builder returned |

To add context of your own (tables, derived chart facts), return it from your file's `buildContext(base)`. It runs once, on first use, and may read everything above:

```ts
export function buildContext(base: ForecastContext): BaziContext {
  return { dayMaster: base.pillars().day.stem, /* tables, strength score, favourable set … */ };
}
// in a binding:  const b = ctx.extension<BaziContext>('bazi')!;
```

Put what several of your rules share there, so it is computed once. If the engine lacks something (an aspect function, a table), add it in your own files and test it against hand-computed cases; the specification lists where larger additions go (`systems/bazi/relations.ts` and so on) but coordinate before touching `systems/`.

## One worked example

This is from `test/forecast/synthetic.ts`; the rule and binding are invented and say nothing about anything.

```ts
const luck = rule({ id: 'synth.bazi-luck', tradition: 'bazi', strength: 3, dedupeKey: 'period-fav:luck' });
// template (from rule()): 'The {planet} period brings {thing} in {year}.'

const luckBinding: RuleBinding = {
  ruleId: luck.id,
  tradition: 'bazi',
  fire: () =>
    [2033, 2034].map((year) => ({
      clock: 'luck',
      startUtcMs: Date.UTC(year, 0, 1),
      endUtcMs: Date.UTC(year + 1, 0, 1),
      facts: [
        { key: 'planet', label: 'Planet', value: 'Jupiter' },
        { key: 'thing', label: 'Thing', value: 'a gain' },
        { key: 'year', label: 'Year', value: year },
      ],
    })),
};
```

Evaluated over 2031 to 2040 this gives two signals, ids `synth.bazi-luck@<startMs>@wealth`, with the sentence `The Jupiter period brings a gain in 2033.` A second rule sharing the dedupe key `period-fav:luck` and firing the same window counts once in the reading (the stronger rule is kept, the other is listed under "same fact, also reported by"). Use `dedupeKey` only as the rule file gives it; the instance (the window, or your `dedupeInstance`) is appended by the framework.

## Marking a rule not evaluated, and what waits for a convention

- **Cannot be done:** add `{ ruleId, reason }` to `NOT_EVALUATED` in your file. The reason is printed to the reader: say what is missing ("needs the house system the engine does not compute").
- **Needs the sex convention** (BaZi spouse and children rules; anything that needs luck pillars): set `requires: { sex: true }` on the binding. Without `baziSexConvention` the registry then withholds the rule and lists it as "needs sex convention"; your `fire` is not called. A rule whose data inputs mention `sex` is treated the same unless your binding says `requires: { sex: false }` because it can use the annual pillar alone.
- **Needs the birth time** (ascendant, houses, Lagna, hour pillar, firdaria sect): set `requires: { birthTime: true }`. It is withheld when no time was given or the stated uncertainty exceeds `birthTimeLimitMinutes`. The framework also reruns the evaluation with the moment moved by the uncertainty and prints which readings would change.
- **Only part of a bound rule is evaluated** (a branch of its condition that the sentence cannot state, or that needs what the engine cannot compute): keep the rule bound and add `{ ruleId, branch, reason }` to `NOT_EVALUATED_BRANCHES` in your file, naming the branch in the condition's own words. The registry lists it beside the rules not evaluated ("only part of this rule is evaluated; not evaluated: ..."), refuses a branch of a rule that is not bound, and the binding's test must show that the branch does not fire. A reason is plain words a reader can follow, not the engine's internal vocabulary.
- **The chart itself silences a level** (a balanced BaZi chart names no favourite, so the levels that judge by the favourite say nothing): export `chartNotes(ctx)` from your file, returning `{ tradition, levels, text }` with the text from the phrasebook. The note is put on every reading of those levels, the level is read even where none of its rules fired, and the year view and statement list print it.
- **Health rules** use tendency wording; the audit refuses mortality or diagnosis words in a health sentence. The only listed exception is a template in the Vedic data (`KNOWN_TEMPLATE_EXCEPTIONS` in `phrasebook.ts`).
- When every rule of your tradition is bound or listed, set `COMPLETE = true`. The registry test then fails if a rule is neither.

A modifier that lasts over many statements (a star a luck pillar brings, over ten year pillars) is shown once in the statement list, on the first statement it qualifies, with its own span and the count of the others it qualifies; write the modifier once with its whole span and do not split it into years.

## What the registry will run on your work

`test/forecast/registry.test.ts` runs `auditRegistry(DEFAULT_REGISTRY, input)` over five sample moments, with no sex convention and with each of the two, for 2031 to 2040, and fails on any of:

1. a binding for a rule that does not exist, in another tradition's file, or bound twice; a rule both bound and not evaluated;
2. with `COMPLETE = true`, a rule of your tradition that is neither bound nor listed;
3. a `fire` that throws, or that gives different firings when called twice on one input;
4. a firing that is malformed: end before start, only one end null, an unknown clock, a repeated fact key, topics outside the rule's, a slot of the template or `dedupeKey` without a fact;
5. a non-finite number among the facts;
6. a banned word (likely, probably, chance, percent, probability, confidence, will) in a sentence, or mortality or diagnosis wording in a health sentence;
7. a binding that is called although the run withholds its rule (no sex convention, birth time too uncertain).

Run it yourself while you work: `cd overlay && npx vitest run packages/core/test/forecast`. To see what is bound, withheld and unbound for your tradition:

```ts
import { DEFAULT_REGISTRY, report } from './registry.ts';
const r = report(DEFAULT_REGISTRY, { traditions: ['bazi', 'vedic', 'iching'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
r.counts.bazi;      // { total, bound, withheld, unbound, heldBack }
r.coverage.bazi;    // bound rules per topic: the coverage printed with every output
```

Write your own tests in `test/forecast/<tradition>.test.ts`: the specification's section 13 lists what is expected (every table you type in against the values the rule file states; the corrected-rule behaviours; sentences equal template plus facts). Use only the sample moments in `fixtures/moments.ts`; never the birth data of any real person, including the example charts in the sources. A quotation in a test or a file is at most 25 words and copies no modern translation. Every source file starts with the two-line licence header. Finish with `npm run generate` and `npm run check`.

## Readings the engine makes where a rule file is silent

These are the places where a binding had to read a condition, and the reading is stated here so that nobody has to find it in the code.

- `lilly.wealth.promise-mixed` says that the number of strong significators equals the number of weak ones. Read literally that also holds when both are zero, but then `promise-moderate` speaks, so the binding requires at least one strong and one weak.
- `parashari.dasha-lord-3-11-lord` lists wealth as a topic, but the 11th lord is evaluated for life in general only (the rule file reads the 11th lord as mixed for wealth). This is listed with the rules not evaluated.
- `parashari.yogakaraka-kendra-trikona`: a kendra lord that the Lagna table calls malefic forms no link unless it also owns a trikona. The evil-house cancellation is applied on top.
- `bazi.yangren`: the rule gives no direction (`activates`). The passage the rule cites (三命通會 卷三 論羊刃), as the page used prints it, does not state when a 官殺 star holds the blade, so the gloss "good when held" is not bound as a sign. The sentence names the blade branch and says whether a 官殺 star stands revealed in a stem of the chart, is only hidden in a branch, or is absent. Sentence and direction never disagree because there is no direction.
- `bazi.officer-star-in-luck`: the clause "favourable if the element is favoured" and the clause on 官殺混雜 can both hold. The source passage (淵海子平 論官殺混雜要制伏) says a mixing harms the self and is to be controlled, and does not say that it outweighs or yields to a favoured element. When both clauses hold the firing is `mixed`, and the sentence names both clauses and says the source does not say which prevails. The binding never picks a winner, and the outcome does not depend on the class of chart (strong, weak or balanced): a chart that does not favour the element has only the mixing clause.
- `bazi.wealth-star-in-luck` and `bazi.peer-in-luck` have their own dedupe keys. A wealth star arriving and a peer star arriving are two facts of one pillar (the stem can be the one and the main qi of the branch the other). Dedupe exists only so that one fact is not counted twice. Years in which both hold read as the rules say, with the plain count of each.
- A calendar year takes in a BaZi year pillar that fills at least 15 days of it. The pillar of a year changes at Lichun, 3 to 5 February, so a calendar year's own pillar fills about 11 months and the previous pillar fills about a month; both count, and the headline can rest on the earlier pillar alone.
- The grid's word for a cell: a rule that itself states "mixed" counts with the favourable and the cautioning ones, so a cell of favourable and rule-stated mixed statements reads "mixed". The grid legend and the guide say so.
- The grader of the I Ching reads a verdict word that follows a negator (无, 匪, 不, 弗, 勿, 未) as a whole formula, by the table in `systems/iching/negations.json`. The table is the project's own reading of the grammar of the text: its status is derived and it follows no commentary. Class a, a negated word of misfortune (无咎, 无悔, 悔亡, 无大咎, 何咎, 何其咎, 无祇悔, 无眚, 匪咎), states that something bad is absent; it carries no direction and is shown as a note with the formula in characters and a literal gloss. Class b, a negated word of advantage (不利 with what follows, 无攸利), reads as unfavourable for the thing named. Class c, 无不利, reads as favourable. Class d, every other negator before a verdict word (无譽), carries no direction and is shown as a note. A statement that holds only notes is still shown, with no direction; none drops out. `test/fixtures/iching-negated-formulas.json` lists every such formula of the 450 statements (64 judgments, 384 lines, 用九 and 用六) with its class, and the grader is tested against the whole list. 勿用 and 不可涉大川 are not formulas of this table: no verdict word follows the negator, and they stay as tokens.
- The `strength` of a rule (1 to 3) is an ordering key. It serves one purpose: where two rules report the same fact (same dedupe key and instance), the larger key is the one kept and listed first, and the other is listed as "same fact, also reported by". It is never shown, never counted, never a weight in a reading, and no badge or sentence prints it. A technique that has a rule which itself states a mixed result reads "mixed" for that year even beside a rule that supports; the tally then says "1 rule supports, 1 is stated as mixed".
