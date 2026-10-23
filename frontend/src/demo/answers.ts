import type { Source } from "../lib/types"

/**
 * Pre-written answers for the demo build. Each matches a suggestion on the home
 * screen, so a visitor sees every kind of answer the real app produces: cited prose,
 * a table, code, and Bangla. Facts are kept general and every source is a real page.
 */
export type DemoAnswer = {
  match: RegExp
  route: string
  model: string
  sources: Omit<Source, "n">[]
  text: string
}

const web = (title: string, url: string, snippet: string): Omit<Source, "n"> => ({
  title,
  url,
  snippet,
  kind: "web",
  authors: [],
  year: null,
  doi: null,
})

export const DEMO_ANSWERS: DemoAnswer[] = [
  {
    match: /bkash|nagad|mobile money|send money/i,
    route: "openrouter",
    model: "anthropic/claude-sonnet-4.5",
    sources: [
      web(
        "bKash - Wikipedia",
        "https://en.wikipedia.org/wiki/BKash",
        "bKash is a mobile financial service in Bangladesh operating under the authority of Bangladesh Bank as a subsidiary of BRAC Bank.",
      ),
      web(
        "Nagad - Wikipedia",
        "https://en.wikipedia.org/wiki/Nagad",
        "Nagad is a digital financial service in Bangladesh, launched in 2019 in partnership with the Bangladesh Post Office.",
      ),
      web(
        "bKash official site",
        "https://www.bkash.com/",
        "Send money, cash out, pay bills and merchants from the bKash app.",
      ),
      web(
        "Nagad official site",
        "https://nagad.com.bd/",
        "Nagad: send money, cash out, mobile recharge and payments.",
      ),
    ],
    text: `Both are mobile financial services (MFS) regulated by Bangladesh Bank, and both let you send money, cash out at agents, pay merchants and recharge mobile balance [1][2].

## How they differ

| | bKash | Nagad |
|---|---|---|
| Operator | Subsidiary of BRAC Bank [1] | Launched with the Bangladesh Post Office [2] |
| Started | 2011 [1] | 2019 [2] |
| Best known for | The largest agent network | Lower advertised fees at launch |

## Which to use for sending money

- **Check today's tariff first.** Both publish send-money and cash-out charges in their apps, and the rates change with promotions [3][4].
- **Use the recipient's service.** Sending within the same MFS is simpler than moving money between providers.
- **Cash out is the main cost.** Sending is often cheap; the agent cash-out charge is what adds up for the recipient.

If you tell me the amount and how the recipient will use the money, I can work out which option costs less.`,
  },
  {
    match: /padma/i,
    route: "openrouter",
    model: "anthropic/claude-sonnet-4.5",
    sources: [
      web(
        "Padma Bridge - Wikipedia",
        "https://en.wikipedia.org/wiki/Padma_Bridge",
        "The Padma Multipurpose Bridge is a two-level road-rail bridge across the Padma River, opened on 25 June 2022.",
      ),
      web(
        "Padma Bridge Rail Link - Wikipedia",
        "https://en.wikipedia.org/wiki/Padma_Bridge_Rail_Link",
        "The rail link connects Dhaka with Jessore across the Padma Bridge.",
      ),
    ],
    text: `The Padma Bridge opened on **25 June 2022** and links Dhaka with the southwest of Bangladesh by road, and later by rail [1][2].

Before it opened, travellers from districts such as Khulna, Barishal and Faridpur crossed the Padma River by ferry. Crossings could take hours, and fog or high water often stopped them altogether.

### What changed

1. **Shorter, predictable journeys.** A road trip to Dhaka no longer depends on ferry queues, so journeys from many southwestern districts are hours shorter [1].
2. **A rail connection.** The Padma Bridge Rail Link runs trains from Dhaka across the river towards Jessore [2].
3. **Freight and trade.** Perishable goods such as fish and vegetables reach Dhaka markets faster.

> The bridge is about 6.15 km long, carries road traffic on its upper deck and the railway on its lower deck [1].`,
  },
  {
    match: /python|phone number|mobile number|regex|validate/i,
    route: "local_code",
    model: "codellama:7b-instruct-q4_K_M",
    sources: [
      web(
        "re - Regular expression operations",
        "https://docs.python.org/3/library/re.html",
        "This module provides regular expression matching operations similar to those found in Perl.",
      ),
      web(
        "Telephone numbers in Bangladesh - Wikipedia",
        "https://en.wikipedia.org/wiki/Telephone_numbers_in_Bangladesh",
        "Mobile numbers in Bangladesh have 11 digits and start with 01, followed by the operator code.",
      ),
    ],
    text: `Bangladeshi mobile numbers have 11 digits: \`01\`, then an operator digit from 3 to 9, then 8 more digits. They may be written with the country code \`+880\` [2].

\`\`\`python
import re

# 01 + operator digit (3-9) + 8 digits, optionally prefixed with +88 or 88.
BD_MOBILE = re.compile(r"^(?:\\+?88)?01[3-9]\\d{8}$")


def is_bd_mobile(number: str) -> bool:
    """Return True for a valid Bangladeshi mobile number.

    Spaces and dashes are ignored, so "017-1234 5678" is accepted.
    """
    cleaned = re.sub(r"[\\s-]", "", number)
    return BD_MOBILE.fullmatch(cleaned) is not None


assert is_bd_mobile("01712345678")
assert is_bd_mobile("+880 1812-345678")
assert not is_bd_mobile("01212345678")  # 012 is not a mobile operator code
\`\`\`

The pattern uses \`fullmatch\` so extra characters before or after the number fail [1]. Use \`is_bd_mobile\` at the point where a number enters your system, such as a sign-up form, and store the cleaned form.`,
  },
  {
    match: /রাজধানী|capital|dhaka|ঢাকা/i,
    route: "local_general",
    model: "llama3:8b-instruct-q4_K_M",
    sources: [
      web(
        "ঢাকা - উইকিপিডিয়া",
        "https://bn.wikipedia.org/wiki/%E0%A6%A2%E0%A6%BE%E0%A6%95%E0%A6%BE",
        "ঢাকা বাংলাদেশের রাজধানী ও বৃহত্তম শহর।",
      ),
      web(
        "Dhaka - Wikipedia",
        "https://en.wikipedia.org/wiki/Dhaka",
        "Dhaka is the capital and largest city of Bangladesh, on the Buriganga River.",
      ),
    ],
    text: `বাংলাদেশের রাজধানী **ঢাকা**। এটি দেশের বৃহত্তম শহর এবং বুড়িগঙ্গা নদীর তীরে অবস্থিত [1][2]।

ঢাকা দেশের প্রশাসনিক, অর্থনৈতিক ও সাংস্কৃতিক কেন্দ্র। জাতীয় সংসদ, সুপ্রিম কোর্ট এবং বেশিরভাগ মন্ত্রণালয় এখানেই অবস্থিত [2]।`,
  },
]

/** Shown for any question the demo has no sample for. Says plainly what the demo is. */
export const DEMO_FALLBACK: DemoAnswer = {
  match: /.*/,
  route: "local_general",
  model: "llama3:8b-instruct-q4_K_M",
  sources: [],
  text: `This is the **Kothora demo**, so answers here are pre-written samples. The live service searches the web and answers any question, in Bangla or English, with citations.

Try one of the sample questions:

- Compare bKash and Nagad for sending money
- How did the Padma Bridge change travel to Dhaka?
- Write a Python function to validate a Bangladeshi mobile number
- বাংলাদেশের রাজধানী কোথায়?`,
}

export function findDemoAnswer(question: string): DemoAnswer {
  return DEMO_ANSWERS.find((answer) => answer.match.test(question)) ?? DEMO_FALLBACK
}
