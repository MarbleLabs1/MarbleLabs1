/**
 * Seeds the database with example stories so the app has something to show.
 *
 * Run: npm run seed          (adds to whatever is there)
 *      npm run seed -- --reset  (wipes first)
 *
 * The companies here are invented. That is deliberate: seeding a site like this with
 * real employer names would publish fabricated allegations against real businesses,
 * which is precisely what the moderation rules exist to prevent.
 */

import { randomBytes } from "node:crypto";
import {
  anonHash,
  db,
  insertReceipts,
  insertStory,
  migrateModeration,
  migrateReceipts,
  upsertCompany,
  type ReceiptKind,
} from "../src/lib/db.ts";
import { looksAfterHours } from "../src/lib/receipts.ts";

type SeedReceipt = {
  kind: ReceiptKind;
  sender: string;
  when?: string;
  subject?: string;
  content: string;
};

type SeedStory = {
  company: string;
  industry: string;
  size: string;
  headline: string;
  body: string;
  role: string;
  seniority: string;
  tenure: number;
  reasons: string[];
  severity: number;
  warn: boolean;
  region?: string;
  echoes?: number;
  receipts?: SeedReceipt[];
};

const STORIES: SeedStory[] = [
  {
    company: "Northwind Dynamics",
    industry: "Software",
    size: "201-1000",
    headline: "Hired to lead a team of six, given the team on day one and nobody by month three",
    body: `The offer said Engineering Manager, six reports, own the payments roadmap. I signed on a Thursday.

By my third week two of the six had been moved to a "priority initiative" I was not told about until I noticed their calendars. When I asked, I was told to stay flexible.

I raised it four times: once in my 1:1, once in writing, once in a skip-level, once in a document I was asked to make "less negative" before it was shared. The document was never shared.

By month five I had one report left and was still accountable for the payments roadmap in every leadership review. In month six I was asked why delivery had slipped. I resigned in the same meeting, which I had not planned to do.

What would have kept me: anyone at all saying out loud that the plan had changed.`,
    role: "Engineering",
    seniority: "Manager",
    tenure: 6,
    reasons: ["broken_promises", "reorg_churn", "bad_manager"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 14,
    receipts: [
      {
        kind: "invite",
        sender: "My manager",
        when: "Friday 6:47 PM",
        subject: "quick sync",
        content: "No agenda. 15 mins. Camera on please.",
      },
      {
        kind: "email",
        sender: "My manager",
        when: "Sunday 11:20 PM",
        subject: "Re: Re: Re: Team capacity",
        content:
          "Per my last email, the reallocation was already agreed at leadership level. Let's not relitigate this. Focus on delivery.",
      },
      {
        kind: "chat",
        sender: "My manager",
        when: "10:58 PM",
        content: "you around? nothing urgent",
      },
    ],
  },
  {
    company: "Northwind Dynamics",
    industry: "Software",
    size: "201-1000",
    headline: "Third manager in eleven months, each one reversing the last one's roadmap",
    body: `I joined a team of nine. I left a team of three, and two of those had handed in notice.

Every reorg came with the same all-hands slide about focus. Every new manager needed a quarter to "form a view", which in practice meant everything in flight was paused and then quietly cancelled. I shipped nothing I was proud of in a year and a half, not because the work was hard but because nothing survived long enough to finish.

The final straw was small. I asked what the plan was for Q3 and was told, sincerely, that it would be clearer after the reorg. There had been a reorg announced six weeks earlier that had not finished landing.`,
    role: "Engineering",
    seniority: "Senior",
    tenure: 17,
    reasons: ["reorg_churn", "no_growth", "burnout"],
    severity: 3,
    warn: true,
    region: "UK",
    echoes: 22,
    receipts: [
      {
        kind: "policy",
        sender: "Leadership",
        when: "All-hands, Q2",
        subject: "Our renewed focus",
        content:
          "This is not a reorg. This is a realignment around our customer. Nothing changes about what you are working on.",
      },
    ],
  },
  {
    company: "Northwind Dynamics",
    industry: "Software",
    size: "201-1000",
    headline: "Told I exceeded expectations and that there was no budget, in the same sentence",
    body: `Performance review, forty minutes. Thirty-five of them were extremely complimentary. I had covered an entire vacant role for two quarters, unpaid and unacknowledged in any document.

Then: "Exceeds expectations. There's no budget for promotions this cycle, but you're absolutely on the list."

I asked what the list was and who was on it. There was no list. I asked what would change by the next cycle and was told that depended on the market.

I got 22% more elsewhere for the same job title I already had. Nobody asked me a single question in my exit interview about the promotion cycle.`,
    role: "Data & Analytics",
    seniority: "Senior",
    tenure: 29,
    reasons: ["no_growth", "underpaid", "unpaid_overtime"],
    severity: 3,
    warn: false,
    region: "UK",
    echoes: 31,
    receipts: [
      {
        kind: "review",
        sender: "My manager",
        when: "Annual review",
        content:
          "Exceeds expectations across all pillars. No budget for promotion this cycle — you are absolutely on the list.",
      },
    ],
  },
  {
    company: "Northwind Dynamics",
    industry: "Software",
    size: "201-1000",
    headline: "Four of us quit the same quarter and the all-hands called it 'natural churn'",
    body: `Design was seven people in January. By September it was three, and two of those had been there under six months.

Everyone who left gave a version of the same reason in their exit interview. I know because we compared notes afterwards in a group chat that still exists.

The all-hands slide said "natural churn in a competitive market". The market was not competitive that year. We were not churn. We were four people who had each independently decided the same thing.`,
    role: "Design",
    seniority: "Mid",
    tenure: 8,
    reasons: ["bad_manager", "disrespect", "no_growth"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 19,
    receipts: [
      {
        kind: "policy",
        sender: "Leadership",
        when: "All-hands, September",
        subject: "Attrition update",
        content:
          "Design attrition this quarter reflects natural churn in a competitive market. We remain confident in the team's trajectory.",
      },
    ],
  },
  {
    company: "Northwind Dynamics",
    industry: "Software",
    size: "201-1000",
    headline: "Six months in, everyone who onboarded me had already gone",
    body: `I was the fifth hire on a team that had been eight people twelve months earlier. Every single person who trained me left before my probation ended.

There is a specific feeling to being the most senior person on a codebase you learned four months ago. Nobody could tell me why decisions had been made. The answer to almost every question was "the person who knew that has left".

I gave it six months and then did the same thing.`,
    role: "Engineering",
    seniority: "Mid",
    tenure: 7,
    reasons: ["reorg_churn", "burnout", "bad_manager"],
    severity: 4,
    warn: true,
    region: "Remote",
    echoes: 11,
  },
  {
    company: "Northwind Dynamics",
    industry: "Software",
    size: "201-1000",
    headline: "Employee number four on a team that had been nine, and I lasted five months",
    body: `The recruiter told me the team was scaling. That was technically true — it had scaled downwards from nine to four and was hiring to get back to six.

Nobody mentioned that in three interviews. I asked directly why the role was open and was told it was growth. It was a backfill for a backfill.

My onboarding buddy resigned in my second week. The person who took over my onboarding resigned in my seventh. At that point I stopped learning the codebase and started reading the exit stories of people who had already left, which is how I ended up here.

Five months. I gave notice on the same day I found out the roadmap I had been hired to deliver had been cancelled before I joined.`,
    role: "Engineering",
    seniority: "Senior",
    tenure: 5,
    reasons: ["broken_promises", "reorg_churn", "layoff_chaos"],
    severity: 4,
    warn: true,
    region: "Remote",
    echoes: 16,
    receipts: [
      {
        kind: "chat",
        sender: "A recruiter",
        when: "Tuesday 2:15 PM",
        content: "the team's in a real growth phase right now — great time to join!",
      },
      {
        kind: "email",
        sender: "My manager",
        when: "Wednesday 10:40 PM",
        subject: "Re: Q3 roadmap — where did payments go?",
        content:
          "Payments was descoped before you joined. I should have flagged it. Let's find you something else to own.",
      },
    ],
  },
  {
    company: "Meridian Retail Partners",
    industry: "Retail & Hospitality",
    size: "5000+",
    headline: "Trained on a Tuesday, alone on the till by Thursday, gone by month three",
    body: `Two hours of training, most of it a video about the brand values. Then a shift on my own on the busiest till in the store.

When I got things wrong — and I did, constantly, because nobody had shown me — it was dealt with in front of customers. Not shouting. Just a sigh and a "move, I'll do it", which is somehow worse when there is a queue watching.

Three of us from the same intake left within a fortnight of each other. We were all under twenty-two and all of us had been told we were not cut out for retail. Two of us now work in retail elsewhere and are fine at it.`,
    role: "Retail & Hospitality",
    seniority: "Junior",
    tenure: 3,
    reasons: ["bad_manager", "disrespect", "no_growth"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 25,
    receipts: [
      {
        kind: "policy",
        sender: "Leadership",
        when: "Induction video",
        subject: "Our brand values",
        content: "We put people first. Every colleague is a valued member of the Meridian family.",
      },
    ],
  },
  {
    company: "Meridian Retail Partners",
    industry: "Retail & Hospitality",
    size: "5000+",
    headline: "Six months, four managers, and none of them knew my name",
    body: `The store cycled through four managers while I was there. Each one arrived with a plan for the shop floor and left before it landed.

By the fourth I had stopped introducing myself properly because there was no point. I was "the tall one on evenings" for my entire time there.

I do not think any individual manager was bad. They were all being moved around by someone above them, on a timescale that made it impossible to know anyone. The result was a shop full of people who had no idea who they worked for.`,
    role: "Retail & Hospitality",
    seniority: "Junior",
    tenure: 6,
    reasons: ["reorg_churn", "bad_manager", "no_growth"],
    severity: 3,
    warn: true,
    region: "UK",
    echoes: 14,
  },
  {
    company: "Brightpath Care Group",
    industry: "Healthcare",
    size: "1001-5000",
    headline: "Six unfilled roles on my ward and a poster about resilience in the break room",
    body: `We ran a fourteen-bed ward on staffing built for nine beds, for eleven months. Not a crisis fortnight — eleven months.

I skipped breaks I was legally entitled to because the alternative was leaving people unattended. I stopped drinking water on shift so I would not need the toilet. That is not a metaphor.

Management response, in order: a resilience poster, a wellbeing app, a mandatory thirty-minute e-learning module on managing your own stress, and a pizza.

I left nursing altogether. Fourteen years. The staffing was never once discussed as the cause in any conversation I was part of.`,
    role: "Healthcare",
    seniority: "Senior",
    tenure: 168,
    reasons: ["burnout", "unpaid_overtime", "no_flexibility", "values_mismatch"],
    severity: 5,
    warn: true,
    region: "UK",
    echoes: 48,
    receipts: [
      {
        kind: "policy",
        sender: "Leadership",
        when: "Break room noticeboard",
        subject: "Building resilience together",
        content:
          "Remember: resilience is a muscle. Have you downloaded the wellbeing app? Ten minutes of mindfulness can transform your shift.",
      },
      {
        kind: "chat",
        sender: "My manager",
        when: "Saturday 5:40 AM",
        content: "any chance you can come in? we're two down. i know it's your weekend 🙏",
      },
    ],
  },
  {
    company: "Brightpath Care Group",
    industry: "Healthcare",
    size: "1001-5000",
    headline: "Asked for one fixed day for chemotherapy appointments, told to be more flexible",
    body: `My mother was having treatment on Tuesdays. I asked for Tuesdays off, or a later start, or to make the hours up at weekends. Any of the three.

I was told the rota could not accommodate a fixed pattern and that I needed to be more flexible. In the same month we onboarded two agency staff at roughly triple my hourly rate.

I used annual leave for the first six weeks. Then I used unpaid leave. Then I resigned, and on my last day my manager said she was sorry and that her hands had been tied. I believe her. That is somehow worse.`,
    role: "Healthcare",
    seniority: "Mid",
    tenure: 41,
    reasons: ["no_flexibility", "disrespect", "burnout"],
    severity: 5,
    warn: true,
    region: "UK",
    echoes: 37,
    receipts: [
      {
        kind: "email",
        sender: "HR",
        when: "Tuesday 9:02 AM",
        subject: "RE: Flexible working request — outcome",
        content:
          "Your request for a fixed non-working day has been declined on business grounds. We would encourage you to remain flexible to the needs of the service. Your wellbeing matters to us.",
      },
    ],
  },
  {
    company: "Brightpath Care Group",
    industry: "Healthcare",
    size: "1001-5000",
    headline: "Every exit interview asked about my new salary and none asked about the rota",
    body: `Nine of us left the same site inside a year. I know what was asked in the exit interviews because we all got the same form.

Four questions about the new employer. Two about whether we would recommend Brightpath as an employer. One free-text box labelled "any other comments", which I filled with four hundred words about the rota.

Nothing changed. A colleague still there tells me the same site is now running on agency cover at a cost that would have funded the substantive posts twice over.`,
    role: "Operations",
    seniority: "Lead / Staff",
    tenure: 55,
    reasons: ["burnout", "bad_manager", "values_mismatch"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 26,
  },
  {
    company: "Meridian Retail Partners",
    industry: "Retail & Hospitality",
    size: "5000+",
    headline: "Rota published Saturday night for a Monday shift, then called unreliable",
    body: `Two years of not being able to plan anything. The rota went up late every single week — sometimes Saturday night for a Monday start.

I asked for it a week ahead. I was told the business needed to respond to demand. Demand, in a shop, on a Monday.

When I could not do a shift I found out about with thirty hours' notice, that went in my file as reliability. I saw the file. There were four entries in it, all of them shifts I had been told about at the weekend.

I left for a job that pays slightly less and tells me my hours a month ahead. I have not once regretted it.`,
    role: "Retail & Hospitality",
    seniority: "Junior",
    tenure: 23,
    reasons: ["no_flexibility", "disrespect", "underpaid"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 42,
    receipts: [
      {
        kind: "chat",
        sender: "My manager",
        when: "Saturday 10:12 PM",
        content: "rota's up for mon. you're on 6am. let me know if that's a problem",
      },
      {
        kind: "review",
        sender: "My manager",
        content: "Concerns around reliability and flexibility. Four instances of shift refusal on file.",
      },
    ],
  },
  {
    company: "Meridian Retail Partners",
    industry: "Retail & Hospitality",
    size: "5000+",
    headline: "Promoted to supervisor for 40p an hour and full accountability for the till",
    body: `The promotion came with keys, cash responsibility, opening and closing, and rota input. It came with forty pence an hour.

I worked out the maths on a break: the extra responsibility was about nine hours of unpaid admin a week at home, doing the rota on my phone because there was no office time for it. Net, I was earning less per hour worked than before the promotion.

When I raised it I was told supervisor was a stepping stone and that it looks great on a CV. It does, in fairness. That is how I got the job I have now.`,
    role: "Retail & Hospitality",
    seniority: "Manager",
    tenure: 31,
    reasons: ["underpaid", "unpaid_overtime", "no_growth"],
    severity: 3,
    warn: true,
    region: "UK",
    echoes: 29,
  },
  {
    company: "Meridian Retail Partners",
    industry: "Retail & Hospitality",
    size: "5000+",
    headline: "Nine of eleven on my shift gone in five months and head office sent a survey",
    body: `Eleven people on the evening shift in March. Two of us by August.

Head office response to a store losing eighty percent of a shift: an engagement survey, sent to the two of us left. It asked whether we felt valued on a scale of one to five, and whether we would recommend the store as a place to work.

I answered honestly. I was then asked by the store manager, kindly and off the record, whether I could soften it because low scores create work for her that she does not have time for. I softened it. I also left.`,
    role: "Retail & Hospitality",
    seniority: "Junior",
    tenure: 5,
    reasons: ["burnout", "bad_manager", "underpaid"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 33,
    receipts: [
      {
        kind: "email",
        sender: "HR",
        when: "August",
        subject: "We want to hear from you! 🎉",
        content:
          "Your voice matters! Please take 12 minutes to complete our engagement survey. On a scale of 1-5, how valued do you feel?",
      },
    ],
  },
  {
    company: "Meridian Retail Partners",
    industry: "Retail & Hospitality",
    size: "5000+",
    headline: "Four months, three of them covering a vacancy nobody was hiring for",
    body: `I was hired into a two-person team. The other person left in my second week and was not replaced, because the role was "under review".

Under review lasted the rest of my time there. I did two jobs on one salary and was thanked for my flexibility in an email that also asked whether I could pick up a third area temporarily.

Four months. I am not proud of leaving that fast but I would do it again sooner.`,
    role: "Operations",
    seniority: "Mid",
    tenure: 4,
    reasons: ["unpaid_overtime", "broken_promises", "burnout"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 8,
  },
  {
    company: "Halcyon Financial Services",
    industry: "Finance",
    size: "1001-5000",
    headline: "Asked to soften a risk note for a client meeting, then blamed when the risk arrived",
    body: `I wrote a note flagging an exposure. I was asked to make it "less alarming for the client conversation". I softened the language but kept the numbers, which felt like a compromise I could live with.

The exposure materialised eight months later, roughly in the range I had modelled. In the review that followed, my note was quoted — the softened version — as evidence that the team had not adequately flagged the risk.

I still have both drafts. I did not produce them, because producing them meant naming the person who asked, and I was not willing to end someone's career over my own.

I left three weeks later. I would flag it harder next time and I would not soften anything for anyone.`,
    role: "Finance",
    seniority: "Senior",
    tenure: 34,
    reasons: ["values_mismatch", "disrespect", "bad_manager"],
    severity: 5,
    warn: true,
    region: "UK",
    echoes: 51,
    receipts: [
      {
        kind: "email",
        sender: "A director",
        when: "Thursday 8:15 PM",
        subject: "Re: Draft risk note — client version",
        content:
          "Can we soften the framing here? The client relationship is at a delicate stage. Keep the numbers, lose the tone. Send me v2 tonight if you can.",
      },
    ],
  },
  {
    company: "Halcyon Financial Services",
    industry: "Finance",
    size: "1001-5000",
    headline: "Return-to-office announced by email at 5pm on a Friday, effective in three weeks",
    body: `I was hired fully remote. It was in the contract, discussed in the interview, and the reason I took the offer over another one.

Four days a week in an office two hours from my house, announced at 5pm on a Friday, effective in three weeks. The email described it as a return to how we have always worked, which was not true for anyone hired in the previous two years.

I asked about the contract. HR called it a "location flexibility clause" and said the change was within it. Perhaps it was. It was still not what I had agreed to.

Roughly a third of my team left inside four months. Everyone I know who stayed is looking.`,
    role: "Product",
    seniority: "Senior",
    tenure: 26,
    reasons: ["rto_mandate", "broken_promises", "no_flexibility"],
    severity: 3,
    warn: true,
    region: "UK",
    echoes: 64,
    receipts: [
      {
        kind: "email",
        sender: "Leadership",
        when: "Friday 5:04 PM",
        subject: "Returning to how we work best",
        content:
          "From the 1st, we're asking everyone to be in the office four days a week. This is a return to how we've always worked, and we're excited to get the energy back. Please direct questions to your manager.",
      },
      {
        kind: "chat",
        sender: "My manager",
        when: "Friday 5:31 PM",
        content: "before you ask — i found out at the same time you did",
      },
    ],
  },
  {
    company: "Halcyon Financial Services",
    industry: "Finance",
    size: "1001-5000",
    headline: "My promotion was announced, then unannounced, then announced to someone else",
    body: `Told in March I was going up in the April cycle. Told in April the cycle had moved to July. Told in July that the budget had been reallocated and that I should be patient.

In September the role I had been told about was posted externally, at a band above what I had been promised, and filled by an external hire in November. I was asked to help onboard them.

I did help, because they were a decent person who had no idea. I resigned in December.`,
    role: "Finance",
    seniority: "Mid",
    tenure: 38,
    reasons: ["broken_promises", "no_growth", "favoritism"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 24,
  },
  {
    company: "Halcyon Financial Services",
    industry: "Finance",
    size: "1001-5000",
    headline: "Rolling layoffs for seven months with no announcement of when they would stop",
    body: `Not one round. Seven months of Tuesdays where you found out by noticing a calendar had emptied.

Nobody would say how many were left to go, or whether it was finished. The official line each time was that this was the last of it. Three times.

The productivity cost of that is enormous and nobody measures it. I did approximately no useful work between May and September because I was updating my CV and so was everyone else. We all knew that about each other and none of us said it out loud.

I took a role for slightly less money at a company that told me their headcount plan for the year. That was the entire pitch and it worked.`,
    role: "Engineering",
    seniority: "Lead / Staff",
    tenure: 44,
    reasons: ["layoff_chaos", "burnout", "reorg_churn"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 39,
    receipts: [
      {
        kind: "policy",
        sender: "Leadership",
        when: "May, June, and August",
        subject: "An update on our structure",
        content:
          "Today's changes complete our restructuring. We do not anticipate further reductions. Thank you for your patience during this period of uncertainty.",
      },
    ],
  },
  {
    company: "Verdant Studio",
    industry: "Marketing",
    size: "11-50",
    headline: "We were a family until I asked to be paid for the weekend I worked",
    body: `Small agency, genuinely lovely people, and a founder who used the word family in almost every all-hands.

I worked a full weekend before a pitch. On the Monday I asked how time off in lieu worked. The temperature of the room changed. I was told that people who watch the clock are not really a fit for how we work, and that nobody else asks.

Nobody else asked because the same thing had happened to them. I found this out in the leavers' group chat, which by then had more members than the company.

The work was the best I have done. I would still not go back.`,
    role: "Marketing",
    seniority: "Mid",
    tenure: 19,
    reasons: ["unpaid_overtime", "values_mismatch", "disrespect"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 46,
    receipts: [
      {
        kind: "policy",
        sender: "The founder",
        when: "All-hands",
        subject: "How we work",
        content:
          "We're not a company, we're a family. Families don't count hours. Families show up for each other when it matters.",
      },
      {
        kind: "chat",
        sender: "The founder",
        when: "Sunday 9:15 AM",
        content: "morning! quick one — can you take a look at the deck before tomorrow? shouldn't take long 🙂",
      },
    ],
  },
  {
    company: "Verdant Studio",
    industry: "Marketing",
    size: "11-50",
    headline: "The founder's friend was hired above me two weeks after I was told there was no budget",
    body: `I asked about a step up and was told, in detail and apparently honestly, that there was no budget for a senior role this year.

Fourteen days later a senior role was created for someone the founder had worked with previously. Announced in Slack with a genuinely warm message about how great it is to work with people you trust.

I do not begrudge them the job. They were good. But I had been given a specific reason that turned out not to be true, and once you know that you cannot unknow it about anything else you are told.`,
    role: "Design",
    seniority: "Mid",
    tenure: 14,
    reasons: ["favoritism", "broken_promises", "no_growth"],
    severity: 3,
    warn: true,
    region: "UK",
    echoes: 17,
  },
  {
    company: "Verdant Studio",
    industry: "Marketing",
    size: "11-50",
    headline: "Every good idea became the founder's idea by the time it reached the client",
    body: `I pitched a campaign internally. Three weeks later I watched it presented to the client as something that had come out of a conversation the founder had had in the shower.

That happened enough times that I started documenting it, which is a miserable way to spend your energy at a job you otherwise liked.

I left for a place where the credit line in the deck lists who did the work. It is a small thing that turns out not to be a small thing.`,
    role: "Marketing",
    seniority: "Senior",
    tenure: 22,
    reasons: ["favoritism", "disrespect", "no_growth"],
    severity: 3,
    warn: false,
    region: "UK",
    echoes: 13,
  },
  {
    company: "Ironvale Logistics",
    industry: "Logistics & Warehouse",
    size: "1001-5000",
    headline: "Timed toilet breaks, tracked to the second, discussed in my review",
    body: `Handheld scanner logged everything. Idle time was flagged and aggregated weekly.

My review included a figure for total non-productive minutes. When I explained that some of those minutes were the toilet, my manager said he understood completely and that the figure was what it was, and that the system was the system.

I am not a machine and I do not want a job that measures me like one. I gave notice that week. Three others on my shift did the same within a month and I do not think that was a coincidence.`,
    role: "Logistics & Warehouse",
    seniority: "Junior",
    tenure: 9,
    reasons: ["micromanagement", "disrespect", "burnout"],
    severity: 5,
    warn: true,
    region: "UK",
    echoes: 57,
    receipts: [
      {
        kind: "review",
        sender: "My manager",
        content:
          "Non-productive time: 43 mins/shift against a target of 18. Please be mindful of idle time on the handheld.",
      },
    ],
  },
  {
    company: "Ironvale Logistics",
    industry: "Logistics & Warehouse",
    size: "1001-5000",
    headline: "Peak season overtime was mandatory, unpaid at premium, and called 'team spirit'",
    body: `Twelve-hour shifts through November and December. The overtime premium in my contract was not applied because the extra hours were classed as "operational flex".

I raised it with HR and got a document explaining operational flex. I read it three times. It said, in about six hundred words, that the premium did not apply during peak.

Nobody on my shift was under the impression this was legal. Nobody on my shift could afford to be the one who tested it. That is the actual mechanism and it works.`,
    role: "Logistics & Warehouse",
    seniority: "Mid",
    tenure: 15,
    reasons: ["unpaid_overtime", "underpaid", "values_mismatch"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 34,
  },
  {
    company: "Ironvale Logistics",
    industry: "Logistics & Warehouse",
    size: "1001-5000",
    headline: "Eight of us started in March, one was still there in December",
    body: `March intake, eight people. I lasted until August, which made me the second longest.

Nobody was fired. Everybody left. The induction was two hours and the rest was learned by getting it wrong in front of someone who was annoyed about it.

The site's answer to this was a referral bonus. They were paying to refill a bucket without ever once asking about the hole.`,
    role: "Logistics & Warehouse",
    seniority: "Junior",
    tenure: 5,
    reasons: ["bad_manager", "burnout", "no_growth"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 21,
  },
  {
    company: "Solstice Education Trust",
    industry: "Education",
    size: "201-1000",
    headline: "Marking on a Sunday was not overtime, it was 'vocation'",
    body: `Contracted hours bore no relationship to the job. Everyone knew this and everyone worked around it, which is exactly why it never got fixed.

Sunday marking, Saturday trips, evening parents' events, all reframed as vocation. I care enormously about the work — that is why the framing landed so badly. It used the thing I cared about as the reason not to pay me.

I left teaching for corporate training. I earn more and I finish at six. I still think about the students.`,
    role: "Education",
    seniority: "Mid",
    tenure: 62,
    reasons: ["unpaid_overtime", "burnout", "underpaid"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 44,
    receipts: [
      {
        kind: "email",
        sender: "Leadership",
        when: "Sunday 7:48 PM",
        subject: "Reminder: reports due Monday 8am",
        content:
          "A gentle nudge that reports are due first thing. Teaching is a vocation, not a job — thank you for everything you do for our young people.",
      },
    ],
  },
  {
    company: "Solstice Education Trust",
    industry: "Education",
    size: "201-1000",
    headline: "Raised a safeguarding concern and became the problem in the room",
    body: `I followed the policy exactly. I documented it, escalated it in writing, and followed up when I heard nothing.

What changed after that was not the situation. It was how I was treated in meetings. Suddenly I was described as someone who "escalates quickly" and my judgement was queried on unrelated things in front of colleagues.

I am not going to say more than that here, and I am not going to describe the concern, because doing so would identify the child. I left at the end of that term and I would report it again tomorrow.`,
    role: "Education",
    seniority: "Senior",
    tenure: 47,
    reasons: ["values_mismatch", "disrespect", "bad_manager"],
    severity: 5,
    warn: true,
    region: "UK",
    echoes: 38,
  },
  {
    company: "Solstice Education Trust",
    industry: "Education",
    size: "201-1000",
    headline: "Wellbeing week ran during the week our workload doubled",
    body: `Wellbeing week: a fruit bowl, a yoga session at 7:15am, and a mandatory twenty-minute module on managing your own stress.

It was scheduled in the same week as the new data-entry requirement that added roughly five hours to everyone's week, permanently.

I do not think anyone involved was cynical. I think that is worse — it means nobody in that building had a working model of what the actual problem was.`,
    role: "Education",
    seniority: "Junior",
    tenure: 20,
    reasons: ["burnout", "unpaid_overtime", "bad_manager"],
    severity: 3,
    warn: true,
    region: "UK",
    echoes: 27,
    receipts: [
      {
        kind: "policy",
        sender: "Leadership",
        when: "Monday, Wellbeing Week",
        subject: "🧘 Wellbeing Week is here!",
        content:
          "Yoga in the hall at 7:15am. Fruit in the staff room all week. Don't forget your mandatory 20-min stress management module — deadline Friday!",
      },
    ],
  },
  {
    company: "Cobalt Consulting",
    industry: "Consulting",
    size: "5000+",
    headline: "Utilisation targets meant the honest answer to 'how are you' was a career risk",
    body: `Billable target of 92%. Anything you did that was not billable — mentoring, recruitment, writing up what we learned — came out of your evenings, and then was described as a lack of commercial focus if it slipped.

Saying you were at capacity was the single most dangerous thing you could say. I watched two people say it and I watched what happened to their staffing after.

So everyone said yes and everyone was drowning quietly and separately. I left when I noticed I had started lying about capacity as a reflex, without deciding to.`,
    role: "Operations",
    seniority: "Senior",
    tenure: 33,
    reasons: ["burnout", "unpaid_overtime", "micromanagement"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 41,
    receipts: [
      {
        kind: "chat",
        sender: "A director",
        when: "11:47 PM",
        content: "you're at 78% this week. let's get that up. anything you can pull forward?",
      },
    ],
  },
  {
    company: "Cobalt Consulting",
    industry: "Consulting",
    size: "5000+",
    headline: "Two years of promises about the next project being the good one",
    body: `Every staffing conversation was about the next one. This one is a slog but the next one is strategic. That one fell through, but the next one is with a great partner.

Eight projects. None of them were the next one. I got extremely good at a kind of work I do not want to do, which is its own trap because it makes you the obvious person to staff on more of it.

I am not bitter. It was a fine job and I learned a lot. But I gave two years to a sentence that was never once true.`,
    role: "Operations",
    seniority: "Mid",
    tenure: 25,
    reasons: ["broken_promises", "no_growth", "better_offer"],
    severity: 2,
    warn: false,
    region: "UK",
    echoes: 9,
  },
  {
    company: "Cobalt Consulting",
    industry: "Consulting",
    size: "5000+",
    headline: "Left for 30% more, and nothing else was wrong",
    body: `Genuinely no drama. Good manager, work I respected, colleagues I still see.

A competitor offered 30% more for the same level. I told my manager honestly and asked whether anything could be done. She was straight with me: the band would not stretch that far, and she said she would take the offer in my position.

Posting this because a site full of only disasters would give a false picture. Sometimes people leave because someone offered more money and the answer was no. That is not toxicity, it is arithmetic.`,
    role: "Data & Analytics",
    seniority: "Senior",
    tenure: 40,
    reasons: ["better_offer", "underpaid"],
    severity: 1,
    warn: false,
    region: "UK",
    echoes: 6,
  },
  {
    company: "Cobalt Consulting",
    industry: "Consulting",
    size: "5000+",
    headline: "Told to bill hours to a code I had not worked on",
    body: `Asked to move hours between project codes at month end so a number looked right. Framed as an administrative tidy-up.

I asked for it in writing. It did not come in writing. It also did not stop being expected.

I did it once, felt disgusting about it, and started interviewing the next week. I do not know whether it was serious or routine sloppiness, and I was not willing to find out from the inside.`,
    role: "Finance",
    seniority: "Mid",
    tenure: 11,
    reasons: ["values_mismatch", "bad_manager", "broken_promises"],
    severity: 4,
    warn: true,
    region: "UK",
    echoes: 18,
  },
];

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function main() {
  const reset = process.argv.includes("--reset");
  const d = db();
  migrateReceipts();
  migrateModeration();

  if (reset) {
    // Order matters: every table holding a story_id has to go before stories does,
    // or the foreign keys refuse the delete. Add new child tables to the front.
    d.exec(`DELETE FROM moderation_log; DELETE FROM receipts; DELETE FROM echoes;
            DELETE FROM reports; DELETE FROM stories; DELETE FROM companies;
            DELETE FROM subscribers;`);
    console.log("Wiped existing data.");
  }

  const setCreated = d.prepare(`UPDATE stories SET created_at = ? WHERE id = ?`);
  const addEchoRow = d.prepare(
    `INSERT OR IGNORE INTO echoes (story_id, voter_hash) VALUES (?, ?)`,
  );

  let inserted = 0;
  let receiptTotal = 0;

  STORIES.forEach((s, i) => {
    const company = upsertCompany({ name: s.company, industry: s.industry, size_bucket: s.size });
    const id = `seed${String(i).padStart(3, "0")}${randomBytes(3).toString("hex")}`;

    insertStory({
      id,
      company_id: company.id,
      headline: s.headline,
      body: s.body,
      role_family: s.role,
      seniority: s.seniority,
      tenure_months: s.tenure,
      reasons: s.reasons,
      severity: s.severity,
      warn_friend: s.warn,
      region: s.region ?? null,
      status: "published",
      findings: [],
      author_hash: anonHash(`seed-author-${i}`),
    });

    // Spread across the last few months so the timeline and "recent" sort look alive.
    setCreated.run(daysAgo(2 + i * 4 + (i % 3)), id);

    if (s.receipts?.length) {
      insertReceipts(
        id,
        s.receipts.map((r) => ({
          kind: r.kind,
          sender_role: r.sender,
          sent_at_label: r.when ?? null,
          subject: r.subject ?? null,
          content: r.content,
          after_hours: looksAfterHours(r.when ?? ""),
        })),
      );
      receiptTotal += s.receipts.length;
    }

    for (let e = 0; e < (s.echoes ?? 0); e++) {
      addEchoRow.run(id, anonHash(`seed-echo-${i}-${e}`));
    }

    inserted++;
  });

  const companies = (d.prepare(`SELECT COUNT(*) AS n FROM companies`).get() as { n: number }).n;
  console.log(
    `Seeded ${inserted} stories, ${receiptTotal} receipts, across ${companies} companies.`,
  );
  console.log("Run `npm run dev` and open http://localhost:3000");
}

main();
