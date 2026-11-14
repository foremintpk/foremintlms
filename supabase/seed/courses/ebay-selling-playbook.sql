-- Foremint Academy course content: eBay Selling Playbook
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'ebay-selling-playbook';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'eBay Selling Playbook',
    short_description = $t$A practical beginner course on selling on eBay: find inventory that sells, calculate profit before you buy, create listings buyers trust, ship efficiently, handle returns and feedback, and grow a well-run store within eBay's rules.$t$,
    description = $h$<p>eBay Selling Playbook is a practical, beginner-friendly course for anyone who wants to sell on eBay with confidence, whether you are clearing out your home, starting a side business reselling secondhand finds or adding eBay as a channel for an existing business. You will learn how eBay works from the seller's side and build the habits that keep buyers happy and your account in good standing.</p>
<p>The course focuses on repeatable methods rather than hype. You will learn how to research what actually sells, calculate your profit before you buy anything, write listings that are accurate and easy to find, ship items safely, handle returns and disputes calmly and use eBay's tools to grow. Because eBay's fees, limits and policies change and differ between countries, each lesson explains how a rule works and shows you where to confirm the current details on eBay's official pages and in Seller Hub.</p>
<h2>What the course covers</h2>
<ul>
<li><strong>Getting started</strong>: how eBay works for sellers, setting up your account and payouts, understanding fees and the policies every new seller must know.</li>
<li><strong>Sourcing</strong>: choosing what to sell, finding secondhand and new inventory, and calculating profit and return before you buy.</li>
<li><strong>Listing</strong>: photos that build trust, titles and item specifics that help buyers find you, honest descriptions and pricing strategies.</li>
<li><strong>Shipping and service</strong>: shipping policies, packing, international sales, returns, the eBay Money Back Guarantee, feedback and seller performance standards.</li>
<li><strong>Growth</strong>: promoted listings and marketing tools, eBay Stores, inventory systems and bookkeeping.</li>
</ul>
<h2>How you will learn</h2>
<p>Each module contains focused article lessons with checklists and a "Try this" action, so you can practise on real items as you go. The final module ends with a course quiz and a practical assignment in which you research, price and plan real items and write a complete listing. Complete every lesson and pass the quiz to earn your certificate.</p>
<h2>Before you start</h2>
<p>You do not need any selling experience. An eBay account and a smartphone with a decent camera will help you practise, along with a simple spreadsheet for tracking costs. Nothing in this course guarantees sales or profit. Results depend on what you sell, how well you run your processes and market conditions.</p>$h$,
    learning_outcomes = array[
      'Explain how eBay fees, listing formats and search visibility work',
      'Research sold listings to judge demand and realistic prices',
      'Calculate profit and return on investment before buying stock',
      'Create accurate listings with strong photos, titles and item specifics',
      'Set up shipping and return policies that buyers trust',
      'Handle returns, cases and feedback professionally',
      'Meet eBay seller performance standards',
      'Use eBay marketing tools and simple systems to grow a store'
    ],
    requirements = array[
      'No previous selling experience needed',
      'An eBay account, or willingness to create one',
      'A smartphone or camera for product photos',
      'A spreadsheet application for tracking costs and profit'
    ],
    target_audience = array[
      'Beginners who want to start selling on eBay',
      'People reselling secondhand items as a side business',
      'Small retailers adding eBay as a sales channel',
      'Casual sellers who want to work more professionally'
    ],
    tags = array['ebay','ecommerce','reselling','online-selling','sourcing','side-business','listings'],
    level = 'beginner',
    estimated_duration_minutes = 257,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = 'eBay Selling Playbook: Beginner Course | Foremint Academy',
    seo_description = 'Learn to sell on eBay step by step: sourcing, listings, pricing, shipping, returns, feedback and growing a store. A practical beginner course.'
  where id = c;

  ---------------------------------------------------------------------------
  -- Module 1
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Getting started on eBay', $t$Understand how eBay works for sellers, set up your account, learn the fee structure and the core policies.$t$, 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'How eBay works for sellers', $t$Understand listing formats, how buyers find items and how eBay handles payments and buyer protection.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>eBay is a marketplace where individuals and businesses list items for buyers around the world. Unlike a shop you own, you sell within eBay's rules, its search system and its buyer protection. Understanding how those pieces fit together helps you make better decisions from your very first listing.</p>
<h2>Listing formats</h2>
<ul>
<li><strong>Auction:</strong> buyers bid over a set duration and the highest bidder wins, provided any reserve price is met. Auctions suit items that are rare, in high demand or hard to value.</li>
<li><strong>Fixed price (Buy It Now):</strong> buyers purchase immediately at your price. Most everyday items sell this way, and fixed price listings can stay active until they sell or you end them.</li>
<li><strong>Best Offer:</strong> an optional feature on fixed price listings that lets buyers propose a price. You can accept, decline or counter, and set automatic rules.</li>
</ul>
<h2>How buyers find your items</h2>
<p>Most buyers find items through eBay search and its filters. eBay's search engine aims to show the most relevant listings, considering factors such as how well your title and item specifics match the search, your price and shipping, your listing's sales history and your performance as a seller. eBay does not publish an exact formula, so focus on what you control: accurate titles, complete item specifics, competitive pricing and good service.</p>
<p>Filters matter as much as keywords. When buyers filter by brand, size or condition, listings without those item specifics may drop out of their results.</p>
<h2>Payments and buyer protection</h2>
<p>eBay manages payments on the platform. Buyers pay through eBay, and eBay pays out your earnings, minus fees, to your linked bank account on a schedule. New sellers may experience temporary holds on funds while they build a track record.</p>
<p>Buyers are covered by the eBay Money Back Guarantee, which applies when an item does not arrive or is not as described. This protection builds buyer confidence, but it also means accurate listings and reliable shipping are essential for you as a seller.</p>
<h2>What this means for you</h2>
<ul>
<li>Every listing competes in search, so details and accuracy matter.</li>
<li>Your performance as a seller affects your visibility and reputation.</li>
<li>All transactions must stay on eBay, because arranging sales outside the platform is against the rules.</li>
</ul>
<h3>Getting oriented checklist</h3>
<ol>
<li>Search eBay for an item you own and note the mix of auctions and fixed price listings.</li>
<li>Apply filters for condition and brand and see which listings drop out.</li>
<li>Open three listings and compare their titles, photos and item specifics.</li>
<li>Read the eBay Money Back Guarantee page so you understand what buyers can claim.</li>
</ol>
<h3>Try this</h3>
<p>Choose one item you could sell this week. Look at how similar items are listed and decide whether an auction or a fixed price listing would suit it better. Write down your reason in one sentence.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Setting up your account, payouts and Seller Hub', $t$Choose the right account type, set up payouts and business policies, and learn your way around Seller Hub.$t$, 'article', 1, 11, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A well-configured account saves time on every listing and avoids payout delays. This lesson walks you through the decisions to make when you set up, and introduces Seller Hub, the dashboard where you will manage your selling.</p>
<h2>Personal or business account</h2>
<p>eBay offers personal and business accounts. If you are occasionally clearing out household items, a personal account may be fine. If you buy items to resell or sell regularly as a trade, you are likely acting as a business, and in many countries consumer protection and tax rules treat business sellers differently. Business sellers may need to show business details on their listings and give buyers additional rights, such as cancellation rights for distance sales. Check eBay's guidance and your local rules, and ask an accountant if you are unsure.</p>
<h2>Payouts and verification</h2>
<p>To receive payouts, you will be asked to link a bank account and verify your identity. Depending on your country and account type, eBay may ask for personal identification, business registration details and tax information. Make sure the details you enter match your documents exactly. You can usually choose how often you receive payouts, within the options eBay offers.</p>
<h2>Selling limits for new sellers</h2>
<p>New accounts often have monthly limits on the number of items and the total value they can list. These limits protect buyers while you build a history, and they can increase as you sell successfully. eBay shows your current limits in your account, so plan your first months around them rather than buying more stock than you can list.</p>
<h2>Business policies</h2>
<p>Business policies are reusable templates for shipping, returns and payment that you apply to listings. Setting them up once means you do not have to re-enter the same details every time, and changing one policy updates every listing that uses it. You will configure them in detail in Module 4.</p>
<h2>Seller Hub at a glance</h2>
<p>Seller Hub brings your selling tools into one place. Section names change over time, but you will typically find:</p>
<ul>
<li>An overview of tasks, such as orders to ship and messages to answer.</li>
<li>Listings, where you create, edit and manage active and unsold items.</li>
<li>Orders, returns and cancellations.</li>
<li>Marketing tools, such as promoted listings and discounts.</li>
<li>Performance, including your seller level and service metrics.</li>
<li>Research tools, including sold-item data for pricing.</li>
</ul>
<h3>Account setup checklist</h3>
<ol>
<li>Decide whether you are selling as a private individual or as a business.</li>
<li>Complete identity verification and link a bank account for payouts.</li>
<li>Turn on two-step verification for security.</li>
<li>Check your current selling limits.</li>
<li>Create draft shipping, return and payment policies.</li>
<li>Explore each section of Seller Hub.</li>
</ol>
<h3>Try this</h3>
<p>Spend fifteen minutes in Seller Hub. Note where you would find orders to ship, your performance status and the research tool. Then write down your current selling limits.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Understanding eBay fees', $t$Learn how insertion fees, final value fees and optional costs work, and build a simple fee calculator.$t$, 'article', 2, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Fees are one of the biggest differences between a profitable sale and a disappointing one. eBay's fee structure varies by country, category, account type and store subscription, and it changes from time to time. Rather than memorising numbers, learn how each fee works and where to look up current rates on your eBay site's official fees page.</p>
<h2>The main fees</h2>
<h3>Insertion fees</h3>
<p>An insertion fee may be charged when you create a listing. Most accounts receive a monthly allowance of listings with no insertion fee, and eBay Store subscribers usually receive a larger allowance. Once you go beyond your allowance, insertion fees apply per listing.</p>
<h3>Final value fees</h3>
<p>When an item sells, eBay typically charges a final value fee. In many markets this is a percentage of the total amount of the sale, which can include shipping and, in some places, sales tax, plus a fixed amount per order. The percentage often depends on the category and can change above certain sale amounts. In some countries, private sellers pay different or no final value fees on most items, while business sellers pay standard fees. Always check the rules that apply to your account.</p>
<h3>Optional and situational fees</h3>
<ul>
<li>Listing upgrades, such as subtitles or reserve prices on auctions.</li>
<li>Promoted listings advertising fees, which you choose to pay.</li>
<li>Store subscription fees, if you open an eBay Store.</li>
<li>International fees on sales to buyers in other countries.</li>
<li>Currency conversion when payouts are made in a different currency.</li>
<li>In some markets, higher fees if your seller performance falls below standard.</li>
</ul>
<h2>Building a fee calculator</h2>
<p>A simple spreadsheet removes the guesswork. For each item, enter:</p>
<ol>
<li>The expected sale price and the shipping you will charge the buyer.</li>
<li>The final value fee percentage for the category and the fixed per-order fee.</li>
<li>Any insertion fee, if you are beyond your allowance.</li>
<li>Your promoted listings ad rate, if you plan to promote the item.</li>
<li>Your actual shipping and packaging cost.</li>
</ol>
<p>The calculator then shows your total fees and what you keep before the cost of the item. You will add item cost and profit targets in Module 2.</p>
<h2>Checking fees after a sale</h2>
<p>After each sale, compare the fees eBay actually charged with your estimate, using the order or payments details in Seller Hub. If they differ, find out why. Common reasons include assuming the wrong category or forgetting that fees can apply to the shipping charge as well as the item price.</p>
<h3>Fee checklist</h3>
<ul>
<li>Bookmark the official fees page for your eBay site.</li>
<li>Confirm whether you are classed as a private or business seller.</li>
<li>Note your monthly allowance of listings without insertion fees.</li>
<li>Look up the final value fee rate for your top three categories.</li>
<li>Build and test your fee calculator.</li>
</ul>
<h3>Try this</h3>
<p>Pick three items from different categories. Using current rates from your eBay site's fees page, calculate the fees on each at a realistic sale price, including shipping. Note which category has the highest fees as a proportion of the price.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Policies every new seller must know', $t$Avoid listing removals and account restrictions by understanding eBay's core selling policies.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>eBay's policies protect buyers, rights owners and the marketplace as a whole. Breaking them, even by accident, can lead to removed listings, selling restrictions or account suspension. You do not need to memorise every rule, but you do need to know the main areas and check the details before listing anything unusual.</p>
<h2>Prohibited and restricted items</h2>
<p>Some items cannot be sold on eBay at all, and others can be sold only with conditions, such as specific documentation, age restrictions or limits on where they can be shipped. Categories that often carry restrictions include medical devices, cosmetics, food, electrical items, weapons and related accessories, and items made from animal products. Rules differ by country, so check eBay's prohibited and restricted items policy for your site before listing anything in a sensitive area.</p>
<h2>Intellectual property and the VeRO programme</h2>
<p>Rights owners can report listings they believe infringe their trademarks, copyrights or other rights through eBay's Verified Rights Owner (VeRO) programme. Common problems include:</p>
<ul>
<li>Selling counterfeit or replica items.</li>
<li>Using brand names in titles for items that are not that brand, for example to describe a style.</li>
<li>Copying another seller's or a brand's photos and descriptions without permission.</li>
</ul>
<p>List only genuine items, and use your own photos and words.</p>
<h2>Listing practices</h2>
<ul>
<li><strong>Accuracy:</strong> describe condition and flaws honestly, and choose the correct category and item specifics.</li>
<li><strong>Keyword spam:</strong> do not add unrelated brands or terms to attract searches.</li>
<li><strong>Duplicate listings:</strong> listing identical fixed price items several times is generally not allowed.</li>
<li><strong>Off-eBay transactions:</strong> do not offer to sell outside eBay or share contact details for that purpose.</li>
</ul>
<h2>Feedback and buyer protection rules</h2>
<p>Feedback must not be manipulated. You cannot demand positive feedback, offer incentives for it or use it as leverage in a dispute. Sellers can leave only positive feedback for buyers, and if a buyer behaves badly, you use eBay's reporting tools rather than retaliatory feedback.</p>
<p>The eBay Money Back Guarantee still applies when an item does not arrive or is not as described, even if your listing says you do not accept returns.</p>
<h3>Policy check before listing</h3>
<ol>
<li>Is the item allowed on your eBay site and in the countries you ship to?</li>
<li>Is it genuine, and are you using your own photos and description?</li>
<li>Does your title mention only brands that truly apply?</li>
<li>Have you described the condition and every flaw accurately?</li>
<li>Does the category require any extra information or documentation?</li>
</ol>
<h3>Try this</h3>
<p>Look up eBay's prohibited and restricted items policy for one category you are interested in. Write down two items in that category that are restricted and the conditions that apply to them.</p>$h$));

  ---------------------------------------------------------------------------
  -- Module 2
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Sourcing inventory that sells', $t$Choose what to sell, find secondhand and new stock, and calculate profit before you buy.$t$, 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing what to sell and researching demand', $t$Use sold listings, Terapeak research and sell-through rate to judge what sells and at what price.$t$, 'article', 0, 11, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Successful eBay sellers decide what to buy based on what has actually sold, not on what is listed or what they hope will sell. Asking prices tell you what sellers want; sold prices tell you what buyers paid. This lesson shows you how to research both quickly.</p>
<h2>Choosing your direction</h2>
<p>There is no single right category. Common starting points include:</p>
<ul>
<li><strong>Generalist reselling:</strong> buying a variety of secondhand items you can research quickly. It is flexible, but you need to learn many markets.</li>
<li><strong>Niche reselling:</strong> specialising in a category such as vintage clothing, camera gear, books or collectables. Your knowledge becomes an advantage over time.</li>
<li><strong>New items:</strong> selling new stock from wholesale or retail sources, which is more repeatable but often more competitive on price.</li>
</ul>
<p>Choose categories where you have some knowledge or interest, where items are easy to store and ship, and where authenticity is not a major risk for a beginner.</p>
<h2>Researching sold listings</h2>
<p>On eBay's search results page, use the filters to show only sold items. Sold listings are marked so you can tell them apart from listings that ended without a sale. For each search, note:</p>
<ul>
<li>The range of sold prices for items in the same condition.</li>
<li>How many sold in the period shown.</li>
<li>Whether auctions and fixed price listings achieved different prices.</li>
<li>What buyers paid for shipping.</li>
</ul>
<h2>Using Terapeak product research</h2>
<p>Seller Hub includes a research tool called Terapeak that shows sales data over a longer period, including average sold price, number sold and sell-through rate. It is useful for comparing items and spotting seasonality. Check which features are included for your account.</p>
<h2>Sell-through rate</h2>
<p>Sell-through rate compares how many items sold with how many were available over the same period:</p>
<p><code>Sell-through rate = items sold / (items sold + active listings)</code></p>
<p>A higher sell-through rate suggests demand is strong relative to supply, so you are likely to sell faster. A low rate means many sellers are competing for few buyers, which often leads to slow sales or price cuts. Use it alongside price: a slow seller can still be worthwhile if the profit is high and the item is small to store.</p>
<h3>Research routine</h3>
<ol>
<li>Search for the exact item, including the model number where possible.</li>
<li>Filter to sold items and note the price range by condition.</li>
<li>Count active listings and calculate the sell-through rate.</li>
<li>Check Terapeak for longer-term trends.</li>
<li>Record a realistic expected sale price, not the highest one you saw.</li>
</ol>
<h3>Try this</h3>
<p>Research five items you own or could buy locally. For each, record the typical sold price, the number sold recently, the number of active listings and the sell-through rate. Decide which one you would list first and why.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Sourcing secondhand stock locally', $t$Find profitable secondhand items at charity shops, sales and auctions using quick research and clear buying rules.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Secondhand sourcing is how many eBay sellers start, because you can begin with a small budget and learn as you go. Success comes from knowing where to look, researching quickly on the spot and sticking to buying rules so that excitement does not override the numbers.</p>
<h2>Where to source</h2>
<ul>
<li><strong>Charity shops and thrift stores:</strong> a steady supply, low prices and frequent restocking. Visiting regularly matters more than visiting many.</li>
<li><strong>Car boot, yard and garage sales:</strong> sellers want to clear items quickly, so negotiation is expected. Arrive early for the best selection.</li>
<li><strong>Estate and house clearance sales:</strong> large volumes of household goods, tools and collectables, sometimes with bulk discounts near the end.</li>
<li><strong>Local auctions:</strong> mixed lots can be good value, but include the buyer's premium and any other fees in your cost.</li>
<li><strong>Local listings and community groups:</strong> people selling or giving away items, which can be useful for bulky items you can collect.</li>
</ul>
<h2>Researching on the spot</h2>
<p>Use the eBay app on your phone to check sold prices before you buy. Many items carry a model number, barcode or label that makes research faster, and the app can scan some barcodes. When you cannot find an exact match, compare the closest similar items carefully and be conservative.</p>
<h2>Checking condition and authenticity</h2>
<p>Inspect every item before buying. Test electronics where possible, check that sets are complete, look for stains, cracks, missing parts and odours, and confirm sizes. Be wary of branded goods that look too good for the price, because selling counterfeits, even unknowingly, can lead to removed listings and action against your account.</p>
<h2>Setting buying rules</h2>
<p>Rules protect you from impulse buys. Examples include:</p>
<ul>
<li>A maximum buy price as a fraction of the expected sale price, set to leave room for fees and shipping.</li>
<li>A minimum profit per item, so each sale justifies the time spent photographing, listing and shipping.</li>
<li>A rule to skip large, heavy or fragile items unless the profit clearly covers the extra effort and risk.</li>
<li>A limit on how much unsold stock you hold before you buy more.</li>
</ul>
<h3>Sourcing trip checklist</h3>
<ol>
<li>Charge your phone and carry a tape measure and some cash.</li>
<li>Know your buying rules and minimum profit before you leave.</li>
<li>Research each item's sold price, not its asking price.</li>
<li>Inspect and test items before paying.</li>
<li>Record what you paid for each item as soon as you buy it.</li>
</ol>
<h3>Try this</h3>
<p>Visit one local source and research at least ten items without buying anything. Record each item, its asking price, its typical sold price on eBay and whether it would pass your buying rules.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Sourcing new stock: wholesale, liquidation and retail', $t$Understand the opportunities and risks of wholesale suppliers, liquidation lots and retail clearance.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>New stock can make your eBay business more repeatable, because you can buy the same item more than once and reuse your listings. It also brings different risks, such as heavier price competition, brand restrictions and larger upfront purchases. This lesson compares the main sources.</p>
<h2>Wholesale suppliers</h2>
<p>Wholesalers and distributors sell products in bulk to retailers. To buy from them, you often need a registered business and sometimes a minimum order. Before ordering:</p>
<ul>
<li>Confirm the supplier is legitimate and authorised to sell the brands they offer.</li>
<li>Ask whether the brand restricts online or marketplace sales.</li>
<li>Research sold prices on eBay to make sure the wholesale price leaves room for fees, shipping and profit.</li>
<li>Start with a small order to test demand and the supplier's reliability.</li>
</ul>
<h2>Liquidation and returns stock</h2>
<p>Retailers sell excess, returned or end-of-line stock in bulk lots or pallets through liquidation companies. Prices can look attractive, but quality varies widely.</p>
<ul>
<li><strong>Manifested lots</strong> come with a list of contents, so you can research items before buying.</li>
<li><strong>Unmanifested lots</strong> have no detailed list and are much harder to value.</li>
<li>Returned goods may be used, damaged, incomplete or faulty, so budget for items you cannot sell.</li>
<li>Include delivery or collection costs for bulky pallets in your calculations.</li>
</ul>
<h2>Retail clearance and arbitrage</h2>
<p>Some sellers buy discounted items from shops or websites to resell. It requires little setup, but margins are often thin, competition is high when deals are widely known and some brands restrict resale. Check sold prices, not listing prices, before buying, and keep your receipts.</p>
<h2>Handmade and own-brand products</h2>
<p>If you make products yourself or have them made under your own brand, you control supply and pricing. This takes more time and capital, but it avoids competing with many sellers on identical items.</p>
<h3>Due diligence checklist for new stock</h3>
<ol>
<li>Verify the supplier's business details independently.</li>
<li>Confirm you are allowed to resell the brand on eBay.</li>
<li>Research sold prices and sell-through for each product.</li>
<li>Calculate profit per unit after all fees and shipping.</li>
<li>Check the product safety and labelling rules for new goods in your country.</li>
<li>Place a small test order before committing larger sums.</li>
</ol>
<h3>Try this</h3>
<p>Find one wholesale or liquidation offer relevant to a category you are interested in. Research three items from it using eBay's sold listings and decide whether the offer would pass your buying rules. Write down the biggest risk you would face.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Calculating profit and return before you buy', $t$Work out profit, margin and return on investment for every item, including the costs that are easy to forget.$t$, 'article', 3, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Profit on eBay is what remains after every cost, not the difference between what you paid and what you sold for. Calculating it before you buy is the habit that separates a sustainable business from a busy hobby. This lesson gives you a formula, two ratios and a simple tracking system.</p>
<h2>The profit formula</h2>
<p><code>Profit = sale price + shipping charged - eBay fees - promoted listings fee - actual shipping cost - packaging - item cost - other costs</code></p>
<p>Other costs might include travel to sourcing locations, cleaning or repair materials and payment for any help you use. Many new sellers forget that fees can apply to the shipping amount the buyer pays, not just the item price.</p>
<h2>Margin and return on investment</h2>
<ul>
<li><strong>Profit margin</strong> is profit divided by total revenue (sale price plus shipping charged). It shows how much of each sale you keep.</li>
<li><strong>Return on investment (ROI)</strong> is profit divided by item cost. It shows how hard your money is working.</li>
</ul>
<p>An item bought for very little can show a high ROI but a tiny profit, while an expensive item can have a modest ROI but a large profit. Look at both, alongside how quickly the item is likely to sell.</p>
<h2>Accounting for your time</h2>
<p>Each item takes time to source, clean, photograph, list, pack and ship. Set a minimum profit per item that reflects that effort. Low-value items can still be worthwhile when grouped into lots or when they are quick to list from an existing template.</p>
<h2>Working backwards to a maximum buy price</h2>
<p>When you are out sourcing, you rarely have time for a full spreadsheet. Work backwards instead:</p>
<ol>
<li>Start with a realistic expected sale price from sold listings.</li>
<li>Subtract estimated fees, shipping and packaging.</li>
<li>Subtract your minimum profit.</li>
<li>What remains is the most you should pay.</li>
</ol>
<p>If the asking price is above that figure, either negotiate or walk away.</p>
<h3>Tracking every item</h3>
<p>Give each item a simple ID and record it in a spreadsheet with:</p>
<ul>
<li>Date bought, source and item cost.</li>
<li>Date listed, listing price and storage location.</li>
<li>Date sold, sale price, shipping charged, fees and shipping paid.</li>
<li>Final profit, margin, ROI and days to sell.</li>
</ul>
<p>Over time, this data shows which sources, categories and price points work best for you.</p>
<h3>Try this</h3>
<p>Set up your tracking spreadsheet with the columns above and formulas for profit, margin and ROI. Add the five items you researched in the first lesson of this module and calculate a maximum buy price for each.</p>$h$));

  ---------------------------------------------------------------------------
  -- Module 3
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Creating listings that sell', $t$Photograph, describe, title and price your items so buyers can find them and buy with confidence.$t$, 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Product photos that build trust', $t$Take clear, honest photos with simple equipment and meet eBay's photo requirements.$t$, 'article', 0, 11, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Online buyers cannot pick up your item, so your photos do most of the work a shop display would. Clear, honest photos help buyers decide quickly, reduce questions and lower the chance of returns, because the item arrives looking exactly as shown.</p>
<h2>Simple setup, consistent results</h2>
<p>You do not need expensive equipment. A modern smartphone is enough if you control the light and the background.</p>
<ul>
<li><strong>Light:</strong> use soft, even light, such as daylight from a window or two inexpensive lamps. Avoid harsh direct flash, which creates glare and hides detail.</li>
<li><strong>Background:</strong> use a plain, uncluttered background, such as a white or neutral sheet or board.</li>
<li><strong>Stability:</strong> rest your phone on something solid or use a small tripod to avoid blur.</li>
<li><strong>Consistency:</strong> photograph items in the same spot so your listings look professional and you work faster.</li>
</ul>
<h2>Which shots to take</h2>
<ol>
<li>A clear main photo of the whole item, filling most of the frame.</li>
<li>Front, back, sides, top and bottom where relevant.</li>
<li>Labels, model numbers, size tags and brand markings.</li>
<li>Close-ups of texture, materials and important features.</li>
<li>Every flaw, mark or sign of wear, clearly visible.</li>
<li>Accessories and everything else included in the sale.</li>
<li>A sense of scale, such as a tape measure or a common object, where size matters.</li>
</ol>
<h2>eBay's photo rules</h2>
<p>eBay has a photo policy that sets minimum image size and quality and restricts things like borders, added text and watermarks. For used items, you generally need to show the actual item rather than a stock image. eBay allows a set number of photos per listing at no extra cost, so check the current limits and requirements in eBay's photo policy and use as many photos as are helpful.</p>
<h2>Showing flaws honestly</h2>
<p>Photographing flaws may feel as though it lowers your price, but it protects you. A buyer who sees a scratch before buying is unlikely to open a "not as described" return about it later. Mention each flaw in the description as well, so the photos and text match.</p>
<h3>Photo checklist</h3>
<ul>
<li>The item is clean and presentable.</li>
<li>Even light, a plain background and sharp focus.</li>
<li>The main photo shows the whole item clearly.</li>
<li>All angles, labels and included parts are covered.</li>
<li>Every flaw is photographed and noted.</li>
<li>No borders, added text or watermarks.</li>
</ul>
<h3>Try this</h3>
<p>Set up a small photo area at home and photograph one item following the shot list above. Compare your photos with the best recently sold listings for the same item and note one improvement you can make.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Titles, categories and item specifics', $t$Write keyword-rich titles, choose the right category and complete item specifics so buyers find your listing.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Buyers search with keywords and narrow results with filters. Your title, category and item specifics decide whether your listing appears in those searches. Small improvements here often make a bigger difference than lowering your price.</p>
<h2>Writing a strong title</h2>
<p>eBay titles have a fixed character limit, which the listing form shows as you type. Use that space for words buyers actually search for, in a natural order. A useful pattern is:</p>
<p><code>Brand + product type + model or style + key attributes (size, colour, material) + condition notes where useful</code></p>
<ul>
<li>Use the words buyers use, and check how similar sold listings are titled.</li>
<li>Include model numbers, sizes and part numbers exactly as they appear on the item.</li>
<li>Avoid filler such as "look", "wow" or rows of symbols, which waste space and do not help search.</li>
<li>Never add brands or terms that do not apply to your item.</li>
</ul>
<h2>Choosing the category</h2>
<p>eBay usually suggests a category based on your title. Check it carefully: the category determines which item specifics appear, which buyers see your item when they browse and, often, the fee rate. If the suggestion looks wrong, search the category list and choose the most specific accurate option.</p>
<h2>Item specifics</h2>
<p>Item specifics are structured details such as brand, size, colour, material, model and type. They power the filters buyers use, so listings with missing specifics can be filtered out of results. Some specifics are required and others recommended. Fill in every one that applies, accurately.</p>
<h3>Using the product catalogue</h3>
<p>For many products, especially new branded items and electronics, eBay may offer a matching catalogue entry when you enter a barcode or model. Matching to the correct catalogue product can fill in item specifics for you. Only match when your item is exactly that product, and use your own photos whenever the item is used or differs in any way.</p>
<h2>Condition</h2>
<p>Select the condition option that fits, using the definitions eBay shows for your category. Some categories offer more detailed condition grades than others.</p>
<h3>Discoverability checklist</h3>
<ol>
<li>The title uses buyer search words, with the most important details first.</li>
<li>Model numbers and sizes are accurate.</li>
<li>The most specific correct category is selected.</li>
<li>All relevant item specifics are filled in.</li>
<li>A catalogue match is used only when it is exactly right.</li>
<li>The condition matches eBay's definition for the category.</li>
</ol>
<h3>Try this</h3>
<p>Write a title for an item you plan to sell, then compare it with the titles of three recently sold similar items. Revise yours to include any useful search words you missed, and list every item specific the category offers.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Descriptions and condition grading', $t$Write clear, honest, mobile-friendly descriptions that answer questions and reduce returns.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your description is where buyers confirm what they saw in the photos and title. A good description is clear, honest and easy to scan on a phone. It answers likely questions in advance and sets accurate expectations, which reduces messages, returns and negative feedback.</p>
<h2>A simple description structure</h2>
<ol>
<li><strong>Summary:</strong> one or two sentences saying exactly what the item is.</li>
<li><strong>Condition:</strong> an honest description of the overall condition and every flaw.</li>
<li><strong>Key details:</strong> measurements, materials, compatibility, model information or edition.</li>
<li><strong>What is included:</strong> every part, accessory or item in the sale, and anything notably missing.</li>
<li><strong>Testing:</strong> what you tested and how, or a clear statement that you could not test it.</li>
<li><strong>Shipping notes:</strong> anything short that buyers need to know, such as how the item will be packed.</li>
</ol>
<h2>Describing condition accurately</h2>
<p>eBay provides condition options with definitions that vary by category. Pick the one that genuinely matches, then add detail in your own words. Be specific rather than vague:</p>
<ul>
<li>Instead of "some wear", write "light scuffing on the lower left corner, shown in photo 6".</li>
<li>Instead of "works fine", write "powers on, all buttons tested, battery holds a charge for several hours".</li>
<li>For clothing, give measurements as well as the size label, because sizes vary between brands.</li>
</ul>
<p>When you are unsure, describe what you can see and test rather than guessing. Describing flaws in full protects you; leaving them out invites "not as described" claims.</p>
<h2>Formatting for mobile buyers</h2>
<p>Many buyers browse on phones. Keep paragraphs short, use simple lists and avoid large blocks of text. eBay does not allow active content, such as scripts, in listing descriptions, and it restricts links to outside websites, so keep your descriptions plain and readable. A short, reusable template for each category saves time and keeps your listings consistent.</p>
<h2>Untested and faulty items</h2>
<p>If an item does not work or you cannot test it, say so clearly and choose the appropriate condition, such as the option for parts or not working where the category offers it. Buyers of these items accept the risk only if you have described it honestly.</p>
<h3>Description checklist</h3>
<ul>
<li>Starts with a clear summary of the item.</li>
<li>The condition matches eBay's definition and is described in detail.</li>
<li>Measurements and key details are included.</li>
<li>Everything included and missing is listed.</li>
<li>Testing is stated honestly.</li>
<li>The text is easy to read on a phone.</li>
</ul>
<h3>Try this</h3>
<p>Write a reusable description template for your main category using the structure above. Then use it to write the full description for one real item, including at least two specific condition details.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing a format and pricing strategy', $t$Decide between auction and fixed price, set prices from sold data and use Best Offer and markdowns effectively.$t$, 'article', 3, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Pricing is a balance between selling quickly and earning enough to make each sale worthwhile. The right choice depends on the item, the demand and how long you are prepared to wait. Base your decisions on sold data and adjust them based on results.</p>
<h2>Auction or fixed price?</h2>
<h3>When auctions make sense</h3>
<ul>
<li>The item is rare, collectable or in strong demand, so competition between bidders can push the price up.</li>
<li>You genuinely do not know its value and are willing to let the market decide.</li>
<li>You want a sale within a set time frame.</li>
</ul>
<p>Set a starting price you would be content to accept. If you use a reserve price, be aware that it may carry a fee and can discourage bidders. Time the auction to end when buyers in your main market are likely to be online.</p>
<h3>When fixed price makes sense</h3>
<ul>
<li>The item has a clear market value based on sold listings.</li>
<li>Buyers search for it regularly, so it will be found over time.</li>
<li>You want to manage many items efficiently without timing auctions.</li>
</ul>
<p>Fixed price listings can run until the item sells or you end them, which suits a growing inventory.</p>
<h2>Setting a fixed price</h2>
<ol>
<li>Find recently sold listings for the same item in the same condition.</li>
<li>Note the typical sold price, including shipping, rather than the highest result.</li>
<li>Compare your listing quality with the competition, because better photos and details can support a higher price.</li>
<li>Check the price against your profit calculation.</li>
<li>Decide on your lowest acceptable price before any offers arrive.</li>
</ol>
<h2>Best Offer</h2>
<p>Best Offer lets buyers propose a price. Many sellers set the listing price slightly above their target and use Best Offer to negotiate. You can set an automatic acceptance price and an automatic decline price, so offers are handled consistently even when you are busy.</p>
<h2>Adjusting prices over time</h2>
<p>If an item gets views but no sales, review its photos, title and price against current sold data. eBay offers tools for timed price reductions, such as markdown sales, and for sending offers to interested buyers who are watching your item. Reduce prices in planned steps rather than at random, and record what worked.</p>
<h3>Pricing checklist</h3>
<ul>
<li>The format is chosen for a clear reason.</li>
<li>The price is based on recent sold data in the same condition.</li>
<li>Your minimum acceptable price is decided in advance.</li>
<li>Best Offer rules are set where appropriate.</li>
<li>A review date is set for unsold items.</li>
</ul>
<h3>Try this</h3>
<p>For two items, decide whether to use an auction or a fixed price, and set a price or starting price from sold data. Write down your minimum acceptable price and your plan if the item has not sold after 30 days.</p>$h$));

  ---------------------------------------------------------------------------
  -- Module 4
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Shipping, service and seller standards', $t$Ship reliably, handle returns and disputes fairly, and meet eBay's seller performance standards.$t$, 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Setting up shipping policies', $t$Choose shipping cost methods, handling times and services that are accurate, competitive and profitable.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Shipping affects your search visibility, your conversion and your profit. Buyers compare total cost and delivery speed, and eBay measures whether you ship on time. Setting clear shipping policies up front makes every listing faster to create and more reliable.</p>
<h2>Choosing how to charge for shipping</h2>
<ul>
<li><strong>Flat rate:</strong> one shipping price for everyone in a region. It is simple and predictable, but you must check that it covers your costs to distant locations.</li>
<li><strong>Calculated:</strong> eBay works out the cost from the package weight, dimensions and the buyer's location. It is accurate for heavier or bulky items, provided you enter correct package details.</li>
<li><strong>Free shipping:</strong> the cost is built into the item price. Buyers like it and it can help items stand out, but you must include the shipping cost in your profit calculation.</li>
<li><strong>Local collection:</strong> useful for large or heavy items, where available.</li>
</ul>
<h2>Handling time</h2>
<p>Handling time is the number of business days within which you promise to dispatch an item after payment. Choose a handling time you can meet reliably, including when you are busy or away. A shorter handling time can be attractive to buyers, but missing it can count against your seller performance.</p>
<h2>Choosing services and buying labels</h2>
<p>Use services that include tracking for most items, especially valuable ones, because tracking is your evidence of delivery if a buyer reports that an item has not arrived. Many sellers buy postage labels through eBay, which can offer discounted rates and adds tracking to the order automatically. Compare these with carrier rates for your typical parcels.</p>
<h2>Weighing and measuring correctly</h2>
<p>Carriers often charge based on both weight and size, and some use a dimensional weight calculation for larger, lighter parcels. Weigh items when packed, including the box and packing materials, and measure the outer dimensions. Underestimating can lead to extra charges from the carrier.</p>
<h2>Shipping policies in practice</h2>
<p>Create a few reusable shipping policies for your common parcel types, for example large letters, small parcels and large parcels. Save them as business policies so that updating a rate updates every listing that uses it.</p>
<h3>Shipping setup checklist</h3>
<ol>
<li>Weigh and measure your typical packed items.</li>
<li>Compare carrier and eBay label rates for those sizes.</li>
<li>Choose flat, calculated or free shipping for each parcel type.</li>
<li>Set a handling time you can always meet.</li>
<li>Choose tracked services, especially for valuable items.</li>
<li>Save each setup as a reusable shipping policy.</li>
</ol>
<h3>Try this</h3>
<p>Weigh and measure three packed items of different sizes. Get shipping quotes for each and create a shipping policy for each size band, noting the amount you will charge or absorb.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Packing, dispatching and selling internationally', $t$Pack items so they arrive safely, dispatch efficiently and understand your options for reaching overseas buyers.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>An item that arrives damaged costs you the sale, the shipping, often a refund and sometimes your feedback. Good packing is cheap insurance. Once your packing and dispatch routine is reliable, you can consider reaching buyers in other countries.</p>
<h2>Packing that protects</h2>
<ul>
<li>Use a sturdy box or mailer that suits the item's size and fragility. Reused boxes are fine if they are strong and old labels are removed or covered.</li>
<li>Wrap fragile items individually and fill empty space so nothing moves when the box is shaken.</li>
<li>Keep fragile items away from the box walls, with padding on all sides.</li>
<li>Protect clothing, books and paper items from moisture with a plastic bag or wrap.</li>
<li>Seal all seams securely with good-quality tape.</li>
<li>Include a packing slip if helpful, but never offer anything in exchange for positive feedback.</li>
</ul>
<p>A quick shake test before sealing tells you whether anything can move.</p>
<h2>An efficient dispatch routine</h2>
<ol>
<li>Check Seller Hub for orders awaiting dispatch at a fixed time each day.</li>
<li>Pick each item using your storage location codes.</li>
<li>Check the item against the listing before packing.</li>
<li>Pack, weigh and buy the correct postage.</li>
<li>Make sure tracking is added to the order.</li>
<li>Drop off or arrange collection within your handling time.</li>
</ol>
<h2>Selling internationally</h2>
<p>International buyers can expand your market, especially for niche and collectable items. There are two broad approaches.</p>
<h3>eBay-managed international shipping</h3>
<p>In some countries, eBay offers a programme in which you send the item to a domestic hub and eBay or its partner handles the international journey, the customs paperwork and the collection of import charges from the buyer. This reduces complexity, but availability, rules and protections vary by country, so check what eBay offers on your site.</p>
<h3>Shipping internationally yourself</h3>
<p>You choose the carrier and complete the customs declarations. You must describe the contents accurately, state the correct value and check that the item is allowed in the destination country. Buyers may need to pay import duties and taxes, which you should explain in your listing. Allow for longer delivery times and use tracked services.</p>
<h2>Weighing the risk</h2>
<p>International orders take longer to arrive, cost more to return and can be harder to resolve if something goes wrong. Start with lightweight, durable items and expand once your processes are reliable.</p>
<h3>Try this</h3>
<p>Pack one item as if it had sold, then do the shake test. Next, check which international shipping options eBay offers in your country and write down one category of your stock that would suit international buyers, and why.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Returns, cases and the eBay Money Back Guarantee', $t$Set a fair return policy and handle returns and cases calmly to protect your account and your profit.$t$, 'article', 2, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Returns are part of selling online. Handling them well protects your seller standards, your feedback and often your relationship with the buyer. Handling them badly can lead to cases, defects and selling restrictions. The aim is a fair policy and a calm, consistent process.</p>
<h2>Choosing a return policy</h2>
<p>eBay lets you choose whether to accept returns, how long the return window is and who pays return shipping when a buyer changes their mind. Consider the following:</p>
<ul>
<li>Accepting returns can make buyers more confident and may help your listings compete.</li>
<li>In some markets, certain seller benefits or badges require you to offer free returns, so check the current requirements.</li>
<li>If you sell as a business, consumer law in your country may give buyers cancellation or return rights regardless of your eBay policy.</li>
</ul>
<h2>The eBay Money Back Guarantee</h2>
<p>The guarantee covers buyers when an item does not arrive or is not as described. If an item is not as described, for example because it is damaged, the wrong item or materially different from the listing, the seller is usually responsible for the cost of the return, even if the listing says returns are not accepted. This is why accurate listings and tracked shipping matter so much.</p>
<h2>Handling a return request</h2>
<ol>
<li>Respond quickly through the returns section of Seller Hub, within the time eBay allows.</li>
<li>Read the reason and check it against your listing, photos and records.</li>
<li>Choose the appropriate option, such as accepting the return, offering a partial refund where appropriate or providing information.</li>
<li>When the item comes back, inspect it promptly and issue the refund within the required time.</li>
<li>Note the reason in your tracking sheet so you can spot patterns.</li>
</ol>
<p>Keep communication polite and factual. Buyers who feel heard are more likely to resolve things without escalating.</p>
<h2>Items not received and cases</h2>
<p>If a buyer reports that an item has not arrived, check the tracking first and respond with what it shows. If a buyer and seller cannot resolve a request between them, eBay can be asked to step in, which opens a case. Cases that eBay has to close in the buyer's favour can count against your seller performance, so resolve issues yourself wherever it is reasonable to do so.</p>
<h3>Returns checklist</h3>
<ul>
<li>Your return policy is chosen deliberately and saved as a business policy.</li>
<li>Tracking is used on every shipment where practical.</li>
<li>Return requests are answered promptly.</li>
<li>Returned items are inspected and refunded on time.</li>
<li>Return reasons are logged and reviewed monthly.</li>
</ul>
<h3>Try this</h3>
<p>Write a short, polite message template for responding to a return request and another for an item reported as not received. Then decide on your own return policy and write down the reasons for your choice.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Feedback, seller standards and customer communication', $t$Understand how feedback and seller levels work, and build communication habits that keep buyers satisfied.$t$, 'article', 3, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your reputation on eBay is visible to every buyer through your feedback, and it is measured behind the scenes through seller performance standards. Both reward the same behaviour: accurate listings, fast and tracked shipping, and helpful communication.</p>
<h2>How feedback works</h2>
<p>After a transaction, buyers can leave positive, neutral or negative feedback with a short comment, and they may also give more detailed ratings on areas such as item description, communication and shipping. Sellers can leave only positive feedback for buyers. Feedback cannot be bought, demanded or traded, and you must not threaten or pressure a buyer about it.</p>
<p>If you receive unfair feedback, reply professionally and factually so future buyers see your side. In limited circumstances, such as feedback that breaks eBay's rules, it may be removed. Check eBay's feedback policy for the current options.</p>
<h2>Seller performance standards</h2>
<p>eBay evaluates sellers regularly and assigns a seller level, typically Top Rated, Above Standard or Below Standard. The metrics commonly include:</p>
<ul>
<li><strong>Transaction defect rate:</strong> transactions with certain problems, such as orders you cancelled because the item was out of stock.</li>
<li><strong>Cases closed without seller resolution:</strong> cases where eBay had to step in and found in the buyer's favour.</li>
<li><strong>Late shipment rate:</strong> orders delivered late, typically where the item was also not dispatched within your stated handling time.</li>
<li><strong>Tracking uploaded on time:</strong> for some seller levels, adding valid tracking within your handling time.</li>
</ul>
<p>Thresholds, evaluation periods and benefits change and differ by country, so check eBay's seller performance standards page and your performance dashboard in Seller Hub regularly. Top Rated status can bring benefits in some markets, while falling below standard can bring restrictions or higher fees.</p>
<h2>Communication habits</h2>
<ul>
<li>Answer buyer questions promptly, ideally within one business day.</li>
<li>Be specific, and offer measurements, test results or extra photos when asked.</li>
<li>Send a short message if something will be delayed, before the buyer has to ask.</li>
<li>Keep all communication within eBay's messaging system.</li>
<li>Stay polite, even when a buyer is frustrated.</li>
</ul>
<p>Saved message templates for common questions help you reply quickly and consistently.</p>
<h3>Reputation routine</h3>
<ol>
<li>Check messages at least once a day.</li>
<li>Review your performance dashboard weekly.</li>
<li>Leave positive feedback for buyers who pay and communicate well.</li>
<li>Respond professionally to any neutral or negative feedback.</li>
<li>Investigate the cause of any defect and fix the process behind it.</li>
</ol>
<h3>Try this</h3>
<p>Open the performance section of Seller Hub and note your current seller level and each metric shown. Then write three saved message templates for the questions you expect to receive most often.</p>$h$));

  ---------------------------------------------------------------------------
  -- Module 5
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Growing your eBay business', $t$Use eBay's marketing tools, decide whether to open a store and build the systems that let you sell more without chaos.$t$, 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Promoted listings and marketing tools', $t$Understand how eBay advertising and promotions work and how to use them without eroding your profit.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once your listings are accurate and competitively priced, marketing tools can help more buyers see them and encourage those buyers to purchase. Every tool has a cost, either an advertising fee or a discount, so treat each one as an investment you measure.</p>
<h2>Promoted listings</h2>
<p>eBay's advertising products let you pay for extra visibility in search results and other placements. Names and options change, but there are two broad models:</p>
<ul>
<li><strong>Cost per sale:</strong> you choose an ad rate as a percentage of the sale price, and you pay it only if a buyer clicks your promoted listing and then buys within the attribution period eBay specifies. The risk is lower, because you pay only when a sale happens.</li>
<li><strong>Cost per click:</strong> you pay each time someone clicks your ad, whether or not they buy. It can give more control over keywords and placement, but it needs closer monitoring.</li>
</ul>
<p>Before promoting, add the ad rate to your profit calculation. If an item only just meets your minimum profit, a high ad rate can turn the sale into a loss.</p>
<h3>Using promoted listings sensibly</h3>
<ul>
<li>Promote listings that are already well optimised, because ads cannot fix poor photos or an uncompetitive price.</li>
<li>Start with modest ad rates, compare the results and adjust.</li>
<li>Treat eBay's suggested rates as a reference point, not an instruction.</li>
<li>Review advertising reports regularly and stop promotions that do not pay back.</li>
</ul>
<h2>Discounts and offers</h2>
<ul>
<li><strong>Markdown sales:</strong> temporary price reductions shown as a sale, useful for clearing older stock.</li>
<li><strong>Volume pricing:</strong> discounts for buying more than one unit, useful for multi-quantity listings.</li>
<li><strong>Coupons and order discounts:</strong> such as a discount when buyers purchase two or more items, which can increase order size.</li>
<li><strong>Offers to buyers:</strong> sending a discounted offer to buyers who are watching or interested in your item.</li>
</ul>
<p>Availability depends on your account and whether you have a store subscription, so check the marketing section of Seller Hub.</p>
<h2>Measuring results</h2>
<p>For every promotion, record its cost and the sales it produced, then calculate your profit after the promotion. Compare it with a period without the promotion where possible. A promotion that increases sales but reduces your total profit is usually not worth repeating.</p>
<h3>Marketing checklist</h3>
<ol>
<li>Confirm your listings are optimised before promoting them.</li>
<li>Add ad rates and discounts to your profit calculation.</li>
<li>Test one tool at a time.</li>
<li>Set a review date and a success measure in advance.</li>
<li>Keep, adjust or stop each tool based on profit, not just sales.</li>
</ol>
<h3>Try this</h3>
<p>Choose five listings that get views but no sales. Improve one element of each, then run a small promoted listings campaign or a markdown on them for two weeks. Record views, sales and profit before and after.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Scaling with stores, systems and bookkeeping', $t$Decide when an eBay Store makes sense, and build inventory, workflow and record-keeping systems that scale.$t$, 'article', 1, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Growing on eBay is less about working harder and more about working to a system. As your number of listings rises, organisation, efficient routines and accurate records are what allow you to grow without mistakes, lost items or tax surprises.</p>
<h2>Is an eBay Store right for you?</h2>
<p>An eBay Store is a paid subscription available in several tiers. Depending on the tier and your country, benefits can include a larger monthly allowance of listings without insertion fees, reduced final value fees in some categories, a branded storefront, extra marketing tools and promotional credits. Compare the subscription cost with the savings and benefits you would actually use at your current listing and sales volume. Check the current tiers and benefits on eBay's official stores page.</p>
<h2>Inventory organisation</h2>
<ul>
<li>Give every item a unique SKU or ID, and enter it in the custom label field of the listing.</li>
<li>Store items in labelled bins or shelves and record each location in your tracking sheet or in the SKU itself.</li>
<li>Check your inventory regularly, and end listings promptly if an item is lost or damaged.</li>
<li>Keep packing materials organised near your dispatch area.</li>
</ul>
<h2>Batching your workflow</h2>
<p>Switching between tasks constantly is slow. Many sellers batch their work into blocks:</p>
<ol>
<li>Sourcing sessions.</li>
<li>Cleaning and preparation.</li>
<li>Photography for a group of items.</li>
<li>Listing, using templates for each category.</li>
<li>Dispatch at a fixed time each day.</li>
</ol>
<p>Track how long each block takes. When one step becomes a bottleneck, that is the step to improve, outsource or invest in.</p>
<h2>Bookkeeping and tax</h2>
<p>Keep records of every purchase, sale, fee, refund, shipping cost and business expense. Download payout and transaction reports from Seller Hub regularly and reconcile them with your bank account. In many countries, online marketplaces including eBay are required to report seller income to tax authorities, so make sure your own records are complete and accurate. Tax rules vary, so speak to a qualified accountant about income tax, sales tax or VAT and any registration thresholds that apply to you.</p>
<h3>Scaling checklist</h3>
<ul>
<li>Every item has a SKU and a storage location.</li>
<li>Listing templates exist for your main categories.</li>
<li>Work is batched into regular routines.</li>
<li>Monthly records reconcile with eBay reports and bank statements.</li>
<li>Your store subscription decision is reviewed against actual savings and usage.</li>
</ul>
<h3>Try this</h3>
<p>Map your current process from sourcing to dispatch and time each step for one week. Identify your slowest step and write down one change to speed it up. Then compare the cost of the lowest store tier with your current monthly fees to see whether it would save you money.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Why should you research sold listings rather than active listings when pricing an item?$t$, $t$Active listings show what sellers are asking, while sold listings show what buyers actually paid. Sold prices are the more reliable guide to a realistic price.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Sold listings show what buyers actually paid$t$, true, 0),
    (qq, $t$Active listings are hidden from sellers$t$, false, 1),
    (qq, $t$Sold listings always show higher prices$t$, false, 2),
    (qq, $t$eBay requires you to match the last sold price$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$eBay sellers can leave positive, neutral or negative feedback for buyers.$t$, $t$False. Sellers can leave only positive feedback for buyers. If a buyer causes problems, you use eBay's reporting tools instead.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, 'True', false, 0),
    (qq, 'False', true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$An item sold 30 times in the period you checked, and there are 30 active listings for it. Using the formula from this course, what is its sell-through rate?$t$, $t$Sell-through rate = items sold / (items sold + active listings) = 30 / (30 + 30) = 50%.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$50%$t$, true, 0),
    (qq, $t$100%$t$, false, 1),
    (qq, $t$30%$t$, false, 2),
    (qq, $t$25%$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of these should you include when calculating your profit on an eBay sale? Select all that apply.$t$, $t$Profit must account for eBay fees (which can apply to the shipping charged), your actual postage and packaging costs and any promoted listings fee. The original retail price is irrelevant to your profit; what matters is what you paid.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$eBay fees, including any fees on the shipping charged$t$, true, 0),
    (qq, $t$The actual cost of postage and packaging$t$, true, 1),
    (qq, $t$The promoted listings fee, if the item was promoted$t$, true, 2),
    (qq, $t$The original retail price of the item when new$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$A buyer opens a return saying the item is not as described, but your listing said you do not accept returns. What generally applies?$t$, $t$The eBay Money Back Guarantee covers items that are not as described, even when a listing says returns are not accepted, and the seller is usually responsible for return shipping in these cases.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The eBay Money Back Guarantee can still apply, and the seller usually pays for the return$t$, true, 0),
    (qq, $t$The buyer has no rights because the listing said no returns$t$, false, 1),
    (qq, $t$The buyer must pay return shipping and a restocking fee$t$, false, 2),
    (qq, $t$The sale is automatically cancelled with no refund$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$For used items, you should photograph the actual item rather than relying on a stock image.$t$, $t$True. eBay's photo policy generally requires used items to be shown with photos of the actual item, and real photos of condition and flaws protect you from not-as-described claims.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, 'True', true, 0),
    (qq, 'False', false, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$When is an auction usually a better choice than a fixed price listing?$t$, $t$Auctions work best when an item is rare or in high demand and its value is hard to judge, so competition between bidders can set the price. Common items with a clear market value usually suit fixed price listings.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$When the item is rare or in high demand and its value is hard to judge$t$, true, 0),
    (qq, $t$When the item is a common product with a clear market value$t$, false, 1),
    (qq, $t$When you want the listing to stay active until it sells$t$, false, 2),
    (qq, $t$When you want to avoid buyers comparing prices$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of the following break eBay's rules? Select all that apply.$t$, $t$Offering incentives for feedback, adding unrelated brand names to a title and encouraging buyers to pay outside eBay all break eBay's policies. Offering free shipping is a normal, allowed choice.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Offering a discount to a buyer in exchange for positive feedback$t$, true, 0),
    (qq, $t$Adding unrelated brand names to a title to attract searches$t$, true, 1),
    (qq, $t$Suggesting that a buyer pays you directly outside eBay to save fees$t$, true, 2),
    (qq, $t$Offering free shipping on your items$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What is the main purpose of item specifics?$t$, $t$Item specifics are structured details such as brand, size and colour. They power the search filters buyers use, so listings with missing specifics can be filtered out of results.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$They power the search filters buyers use to narrow results$t$, true, 0),
    (qq, $t$They replace the need for photos$t$, false, 1),
    (qq, $t$They set your shipping costs automatically$t$, false, 2),
    (qq, $t$They are visible only to eBay staff$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which approach to setting your handling time is most sensible?$t$, $t$Missing your handling time can count against your seller performance, while an unnecessarily long one may put buyers off. Promise a handling time you can always meet.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Choose a handling time you can meet reliably, even when you are busy$t$, true, 0),
    (qq, $t$Always choose the shortest option, then ship whenever you can$t$, false, 1),
    (qq, $t$Choose the longest option so you never need to plan$t$, false, 2),
    (qq, $t$It does not matter, because handling time has no effect on your performance$t$, false, 3);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$Ten questions covering the whole course, from fees and sourcing to listings, shipping, returns and growth. You need 70% to pass, and you can review the correct answers after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'Sourcing and listing plan for five items', $h$<p>In this assignment you will apply the course to real items. You will research, price and plan five items, then write one complete, ready-to-publish listing. You do not need to list or sell anything to complete the assignment, although you are welcome to.</p>
<h2>What to submit</h2>
<ol>
<li><strong>Item research table:</strong> five items you own or could source. For each, record the item, its condition, the source and cost (or estimated cost), the typical sold price, the number sold recently, the number of active listings and the sell-through rate. Include the search terms you used.</li>
<li><strong>Profit calculations:</strong> for each item, estimate the fees using current rates from your eBay site's fees page, plus shipping and packaging, then calculate profit, margin and ROI. State your minimum profit rule and which items pass it.</li>
<li><strong>Format and pricing decisions:</strong> for each item that passes, choose an auction or a fixed price, set a price or starting price, and state your minimum acceptable price and your plan if it does not sell within 30 days.</li>
<li><strong>One complete listing draft:</strong> for your best item, write the title, category, all relevant item specifics, condition, full description and the shipping and return policies you would use. Include your photos, or a shot list if you cannot photograph the item.</li>
<li><strong>Service plan:</strong> a short paragraph on how you would pack and ship this item, plus message templates for a return request and a buyer question.</li>
</ol>
<h2>Guidance</h2>
<ul>
<li>Use real sold data, and label anything that is an estimate.</li>
<li>Make sure your listing would comply with eBay's policies, including accurate condition details and genuine brand use.</li>
<li>If your research shows some items are not worth listing, say so. Good decisions earn marks.</li>
<li>Submit a document, a spreadsheet, a link to a shared file or text in the submission box.</li>
</ul>
<h3>How it will be assessed</h3>
<p>Your submission is graded against the rubric shown with this assignment. You need 60 out of 100 points to pass.</p>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion','Research and pricing','description',$t$Sold data, sell-through rates and pricing decisions are realistic, clearly sourced and applied consistently across all five items.$t$,'points',30),
        jsonb_build_object('id','c2','criterion','Profit calculations','description',$t$Calculations include all fees, shipping and packaging, and use profit, margin and ROI correctly to support buying decisions.$t$,'points',25),
        jsonb_build_object('id','c3','criterion','Listing quality','description',$t$The listing draft has a search-friendly title, the correct category, complete item specifics, honest condition detail and clear photos or a shot list.$t$,'points',30),
        jsonb_build_object('id','c4','criterion','Service and compliance','description',$t$Shipping, returns and message templates are professional, practical and consistent with eBay policies.$t$,'points',15)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', $t$Research, price and plan five real items, and write one complete listing.$t$, 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Put the course into practice by researching, pricing and planning five real items and writing one complete listing. Read the instructions and rubric, then submit your work as text, a file or a link.$t$));
end $$;
