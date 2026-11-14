-- Foremint Academy course content: Amazon FBA Foundations
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'amazon-fba-foundations';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'Amazon FBA Foundations',
    short_description = $t$Learn how to research, source, list, ship and launch a product on Amazon using Fulfillment by Amazon. A practical, beginner-friendly course focused on sound decisions, real unit economics and staying within Amazon's rules.$t$,
    description = $h$<p>Amazon FBA Foundations is a practical, beginner-friendly course that walks you through every stage of building a product business on Amazon using Fulfillment by Amazon (FBA). You will learn how the model actually works, how to judge whether a product is worth selling, how to source it responsibly, how to list and ship it into Amazon's fulfilment network, and how to launch and grow without breaking platform rules.</p>
<p>The course focuses on decisions rather than shortcuts. Instead of promising quick wins, it teaches you how to read demand signals, calculate unit economics before you spend money, vet suppliers, plan inventory and run your first advertising campaigns with clear targets. Because Amazon's fees, limits and policies change regularly, each lesson explains how a rule or fee works and shows you where to confirm the current details in Seller Central and on Amazon's official help pages.</p>
<h2>What the course covers</h2>
<ul>
<li><strong>How FBA works</strong>: selling plans, account setup, the fees that shape your margin and the compliance rules that keep your account healthy.</li>
<li><strong>Product research</strong>: choosing a business model, reading demand and competition, finding a realistic point of difference and validating an idea before you commit.</li>
<li><strong>Sourcing</strong>: finding and vetting suppliers, requesting quotes, ordering samples, managing quality control and calculating landed cost.</li>
<li><strong>Listings and logistics</strong>: product identifiers, writing a listing that converts, preparing and labelling inventory, sending shipments and planning stock levels.</li>
<li><strong>Launch and growth</strong>: compliant review strategies, Sponsored Products advertising, performance metrics and scaling at a pace your cash flow can support.</li>
</ul>
<h2>How you will learn</h2>
<p>Each module contains short, focused article lessons with checklists and a "Try this" action, so you can apply what you learn straight away. The final module ends with a course quiz and a practical assignment in which you build a product opportunity and launch plan for a real product idea. Complete every lesson and pass the quiz to earn your certificate.</p>
<h2>Before you start</h2>
<p>You do not need an existing Amazon account or any prior selling experience. You will get more from the course if you keep a spreadsheet open as you go, because many lessons ask you to run numbers on a product idea. Nothing in this course is a guarantee of sales or profit. Results depend on your product, your execution and market conditions, and selling on Amazon involves real financial risk.</p>$h$,
    learning_outcomes = array[
      'Explain how Fulfillment by Amazon works and when it suits a product',
      'Calculate unit economics, including Amazon fees and landed cost',
      'Research and validate a product using demand and competition signals',
      'Find, vet and brief suppliers, and manage samples and quality control',
      'Create a compliant, conversion-focused product listing',
      'Prepare, label and send inventory to Amazon fulfilment centres',
      'Plan inventory levels to avoid stockouts and excess storage costs',
      'Launch with compliant review tactics and structured Sponsored Products campaigns'
    ],
    requirements = array[
      'No prior selling experience needed',
      'A computer with a spreadsheet application',
      'Willingness to research product ideas and run the numbers',
      'A budget for inventory only if you decide to launch (not needed to complete the course)'
    ],
    target_audience = array[
      'Aspiring sellers planning their first Amazon product',
      'Small business owners adding Amazon as a sales channel',
      'Merchant-fulfilled sellers considering a move to FBA',
      'Freelancers and assistants who support Amazon sellers'
    ],
    tags = array['amazon','fba','ecommerce','product-research','sourcing','private-label','online-selling'],
    level = 'beginner',
    estimated_duration_minutes = 261,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = 'Amazon FBA Foundations: Beginner Course | Foremint Academy',
    seo_description = 'Learn Amazon FBA step by step: product research, sourcing, listings, FBA shipments, launch and scaling. A practical beginner course.'
  where id = c;

  ---------------------------------------------------------------------------
  -- Module 1
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'How Amazon FBA works', $t$Understand the FBA model, selling plans, the fees that shape your margin and the rules you must follow.$t$, 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'What Fulfillment by Amazon is and how it works', $t$See how FBA moves a product from your supplier to the customer, and how it compares with fulfilling orders yourself.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Fulfillment by Amazon (FBA) is a service in which you send inventory to Amazon's fulfilment centres and Amazon stores it, picks and packs each order, ships it to the customer and handles most customer service and returns for those orders. You stay responsible for the product itself: choosing it, sourcing it, listing it, pricing it and making sure it complies with the law and with Amazon's policies. Understanding that split of responsibilities is the foundation for every decision in this course.</p>
<h2>The FBA flow from supplier to customer</h2>
<p>A typical FBA product moves through the same stages each time:</p>
<ol>
<li>You source finished, sellable units from a manufacturer, wholesaler or other supplier.</li>
<li>You create a listing, or add an offer to an existing one, in Seller Central and set the fulfilment channel to FBA.</li>
<li>You create a shipment plan, prepare and label the units, and send them to the fulfilment centres Amazon assigns.</li>
<li>Amazon receives and checks in the units, then makes them available to buy.</li>
<li>When a customer orders, Amazon picks, packs and delivers the item, and you receive the sale proceeds minus fees on your regular payout schedule.</li>
</ol>
<h2>FBA compared with fulfilling orders yourself</h2>
<p>The alternative is fulfilment by merchant (FBM), where you store and ship orders yourself or through your own logistics partner. Neither option is automatically better.</p>
<ul>
<li><strong>FBA strengths:</strong> products are typically eligible for Prime and fast delivery, which can improve conversion; you do not need your own warehouse; and Amazon handles customer service and returns for FBA orders.</li>
<li><strong>FBA trade-offs:</strong> you pay fulfilment and storage fees, you must follow strict prep and labelling rules, the amount you can send may be limited by capacity rules, and slow-selling stock becomes expensive to hold.</li>
<li><strong>FBM strengths:</strong> more control over packaging and stock, and a better fit for oversized, slow-moving or highly customised products.</li>
</ul>
<p>Many sellers use both, for example FBA for fast movers and FBM for bulky or seasonal lines.</p>
<h2>Business models that use FBA</h2>
<p>FBA is a fulfilment method, not a business model. Sellers use it with several models: <strong>private label</strong> (your own brand, made for you by a manufacturer), <strong>wholesale</strong> (buying established brands from authorised suppliers and reselling them) and <strong>retail or online arbitrage</strong> (buying discounted retail stock to resell). Each has different risks, capital needs and rules, which you will compare in Module 2.</p>
<h3>Checklist: is FBA a sensible fit for a product?</h3>
<ul>
<li>It is small and light enough that fulfilment fees leave a healthy margin.</li>
<li>It sells steadily rather than only in one short season.</li>
<li>It is not fragile, perishable or classed as dangerous goods without approval.</li>
<li>It can be prepared and labelled to Amazon's requirements.</li>
<li>Customers in its category value fast, Prime-eligible delivery.</li>
</ul>
<h3>Try this</h3>
<p>Pick three products you have bought on Amazon recently. For each one, check the offer details on the product page to see whether it is shipped by Amazon or by the seller, and note why you think the seller chose that fulfilment method.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing a selling plan and setting up your seller account', $t$Compare the Individual and Professional plans and prepare everything you need for registration and verification.$t$, 'article', 1, 10, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Before you can sell, you need a seller account in the Amazon marketplace where your customers are. Registration is straightforward if you prepare properly, and a few choices you make here, such as your selling plan and business details, affect which tools you can use later.</p>
<h2>Individual and Professional plans</h2>
<p>Amazon offers two main selling plans in most marketplaces:</p>
<ul>
<li><strong>Individual:</strong> no monthly subscription. Instead, you pay a fee for each item sold, on top of other selling fees. It suits people testing the waters with a small number of sales.</li>
<li><strong>Professional:</strong> a monthly subscription with no per-item plan fee. It unlocks tools most FBA businesses rely on, including advertising, bulk listing tools, detailed business reports and eligibility for the featured offer on product pages.</li>
</ul>
<p>The break-even point between the two depends on how many units you expect to sell each month. Check the current plan prices on Amazon's official selling plans page before you decide. You can usually switch plans later from your account settings, so start with the plan that matches your realistic early volume.</p>
<h2>What you need for registration</h2>
<p>Requirements vary by country, but you will usually be asked for:</p>
<ul>
<li>A government-issued photo ID or passport.</li>
<li>A bank account that can receive payments in the marketplace currency, or through a supported currency service.</li>
<li>A chargeable credit or debit card.</li>
<li>A phone number and an email address you check regularly.</li>
<li>Business details, such as your legal business name, address and registration number if you operate as a company.</li>
<li>Tax information, completed through Amazon's tax interview.</li>
</ul>
<p>Amazon verifies your identity, often through document checks and sometimes a video call or address verification. Make sure the name and address on every document match exactly what you enter. Mismatches are a common cause of delays.</p>
<h2>Decisions to make before you register</h2>
<h3>Business structure and taxes</h3>
<p>Decide whether you will sell as an individual or through a registered business, and speak to a qualified accountant about sales tax, VAT or GST obligations in the places you sell and store inventory. Storing stock in a country can create tax obligations there, so this matters for FBA in particular.</p>
<h3>Which marketplace to start in</h3>
<p>Most beginners start in one marketplace, usually the one where they live or where demand for their product is strongest. Expanding later is easier once your processes work.</p>
<h3>Setup checklist</h3>
<ol>
<li>Gather ID, bank, card and business documents with matching details.</li>
<li>Estimate your monthly unit sales and choose a selling plan.</li>
<li>Complete registration and identity verification in Seller Central.</li>
<li>Complete the tax interview and turn on two-step verification.</li>
<li>Review your account settings, notification preferences and the Account Health page.</li>
</ol>
<h3>Try this</h3>
<p>Write down your expected monthly unit sales for your first three months. Then use the current fees on Amazon's selling plans page to work out which plan costs less at that volume, and note the sales level at which the other plan would become cheaper.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Understanding FBA fees and unit economics', $t$Learn the main fee types that affect every sale and build a simple per-unit profit calculation.$t$, 'article', 2, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>On Amazon, revenue is easy to see and profit is easy to misjudge. Every unit you sell carries several fees, and FBA adds costs that depend on size, weight, storage time and inventory levels. Before you choose any product, you need a reliable way to estimate what you actually keep from each sale. This is called unit economics.</p>
<h2>The main fee types</h2>
<p>Amazon's fee schedule is detailed and updated regularly, so always confirm current rates on the official fee pages in Seller Central. These are the categories you will meet most often:</p>
<ul>
<li><strong>Referral fee:</strong> a percentage of the total sale price, which varies by category and usually has a minimum amount per item.</li>
<li><strong>FBA fulfilment fee:</strong> a per-unit fee for picking, packing and shipping, based on the product's size tier and shipping weight.</li>
<li><strong>Monthly storage fee:</strong> charged on the volume your inventory occupies, and typically higher during the peak season at the end of the year.</li>
<li><strong>Inventory-related fees and surcharges:</strong> for example, surcharges on stock stored for a long time and, in some marketplaces, fees linked to how inbound shipments are placed or to running inventory too low relative to demand.</li>
<li><strong>Returns processing:</strong> some categories, or products with high return rates, attract a fee when customers return items.</li>
<li><strong>Selling plan fee:</strong> the monthly subscription or per-item fee from your selling plan.</li>
<li><strong>Optional services:</strong> such as advertising, removal or disposal orders, and any prep or labelling services Amazon offers.</li>
</ul>
<h2>Building a per-unit profit calculation</h2>
<p>Start with a simple formula and refine it as you learn more:</p>
<p><code>Profit per unit = sale price - referral fee - FBA fulfilment fee - storage cost per unit - landed cost - advertising cost per unit - returns allowance</code></p>
<h3>Landed cost</h3>
<p>Landed cost is the full cost of getting one sellable unit to Amazon: product cost, packaging, inspection, freight, duties, customs fees and the cost of shipping into the fulfilment centre. You will calculate it in detail in Module 3.</p>
<h3>Advertising and returns allowances</h3>
<p>New products almost always need advertising, so budget a realistic advertising cost per unit, especially during launch. Add a small allowance for returns and damaged units based on what is normal in your category.</p>
<h2>Using Amazon's revenue calculator</h2>
<p>Amazon provides a revenue calculator that estimates fees for an existing product when you search for it, or when you enter dimensions and weight. Use it to sense-check your spreadsheet. Accurate dimensions matter: a product that is slightly too large can move into a more expensive size tier.</p>
<h3>Unit economics checklist</h3>
<ul>
<li>Measure and weigh the product in its final packaging.</li>
<li>Confirm the size tier and fulfilment fee using current official rates.</li>
<li>Look up the referral fee for the correct category.</li>
<li>Estimate storage cost per unit from your expected sales speed.</li>
<li>Include advertising, returns and a safety margin.</li>
<li>Calculate profit margin and return on investment, not just profit per unit.</li>
</ul>
<h3>Try this</h3>
<p>Find a product similar to one you might sell, enter it into Amazon's revenue calculator and rebuild the same calculation in your own spreadsheet, adding an estimated landed cost and advertising cost. Note which cost has the biggest effect on the margin.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Restricted products, intellectual property and compliance', $t$Learn which products need approval, how intellectual property rules affect you and why compliance documents matter.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Not everything can be sold on Amazon, and some products can only be sold after approval or with specific documentation. Many new sellers lose money by buying inventory first and checking the rules second. Reverse that order: check eligibility, intellectual property and compliance before you place any order.</p>
<h2>Restricted categories and approvals</h2>
<p>Some categories, subcategories, brands and individual products require approval before you can list them. Approval may require invoices from authorised suppliers, product documentation or a track record of good account performance. Requirements differ by marketplace and change over time.</p>
<p>In Seller Central, you can search for a product in the tool for adding products to see whether you are eligible to list it or need to apply first. Check this for any product you are considering, including close variations.</p>
<h2>Dangerous goods and regulated products</h2>
<p>Products that contain batteries, flammable liquids, aerosols, magnets or certain chemicals may be classed as dangerous goods, often called hazmat. These typically need safety data sheets or exemption sheets and a review before Amazon will accept them into fulfilment centres. Other products, such as children's items, cosmetics, electrical goods, items that touch food and supplements, are often subject to specific safety laws and testing requirements in your target country.</p>
<p>Amazon can request compliance documents at any time, and listings can be blocked until you provide them. Keep test reports, certificates and labelling evidence organised and ready.</p>
<h2>Intellectual property</h2>
<p>Intellectual property (IP) rights protect brand names and logos (trademarks), inventions and designs (patents and design rights) and creative works such as photos and text (copyright). On Amazon, you must not:</p>
<ul>
<li>Sell counterfeit goods or products that copy a protected design.</li>
<li>Use another company's brand name in your title or keywords to imply a connection.</li>
<li>Copy another seller's photos or listing text.</li>
</ul>
<p>Rights owners can file complaints that lead to listing removals and account warnings. If you plan to build a private label brand, consider applying for a trademark early, because Amazon Brand Registry generally requires one. Check the current eligibility rules on Amazon's Brand Registry pages.</p>
<h3>Compliance checklist before you buy inventory</h3>
<ol>
<li>Confirm you are eligible to list the product in your target marketplace.</li>
<li>Check whether it could be classed as dangerous goods.</li>
<li>Identify the safety laws, testing and labelling rules that apply in your destination country, using official government sources.</li>
<li>Search for existing trademarks and patents that the product or your brand name could infringe.</li>
<li>Confirm your supplier can provide the documents you will need.</li>
<li>Read Amazon's restricted products pages for the relevant category.</li>
</ol>
<h3>Try this</h3>
<p>Choose two product ideas and run each one through this checklist. For each, write one sentence stating whether it is clear to proceed, needs approval or documentation first, or should be dropped, and why.</p>$h$));

  ---------------------------------------------------------------------------
  -- Module 2
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Product research and validation', $t$Choose a business model, read demand and competition, and validate a product idea before you spend money on inventory.$t$, 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing a business model and product criteria', $t$Compare private label, wholesale and arbitrage, and set the criteria a product must meet before you research it.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Product research goes faster and produces better results when you know what you are looking for. Before you browse a single listing, decide which business model you will use and write down the criteria a product must meet. This turns research from endless scrolling into a repeatable filtering process.</p>
<h2>Comparing the main models</h2>
<h3>Private label</h3>
<p>You work with a manufacturer to produce a product under your own brand. You control the listing, branding and pricing, and you can build long-term brand value. In exchange, you need more upfront capital, longer lead times and the skills to launch a new listing from zero reviews.</p>
<h3>Wholesale</h3>
<p>You buy existing branded products from the brand owner or its authorised distributors and sell them on listings that already exist. Demand is proven, but you share the listing with other sellers, compete for the featured offer and need suppliers who are willing to sell to Amazon resellers.</p>
<h3>Retail and online arbitrage</h3>
<p>You buy discounted products from shops or websites and resell them. It needs less capital to start but is harder to scale, margins can be thin, and you must be careful with brand restrictions, authenticity complaints and retail receipts that Amazon may not accept as proof of supply.</p>
<h2>Setting your product criteria</h2>
<p>For a first private label product, many sellers use criteria like the ones below. Adjust them to your budget and experience, but write them down so you apply them consistently.</p>
<ul>
<li><strong>Size and weight:</strong> small and light enough to stay in a low fulfilment fee tier and keep freight costs down.</li>
<li><strong>Durability:</strong> unlikely to break in transit, with no glass or complex electronics in a first product.</li>
<li><strong>Price point:</strong> high enough that fees, landed cost and advertising still leave a meaningful margin.</li>
<li><strong>Steady demand:</strong> sells throughout the year rather than in one short season.</li>
<li><strong>Simplicity:</strong> few variations, a limited compliance burden and no dangerous goods classification.</li>
<li><strong>Competition you can match:</strong> the top listings are not all dominated by major brands or by Amazon itself.</li>
<li><strong>Room to improve:</strong> customer reviews reveal problems you could realistically solve.</li>
</ul>
<h2>Avoiding common traps</h2>
<p>Do not choose a product only because you like it, because a tool labels it an opportunity or because it is trending this week. Interest in a product helps with marketing, but numbers and customer evidence should decide. Also avoid products that would need medical, safety or performance claims you cannot substantiate.</p>
<h3>Try this</h3>
<p>Write your own product criteria list with at least seven rules, including a minimum target margin and a maximum budget for your first order. Keep it open for the next three lessons, because every idea you research will be tested against it.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Reading demand signals on Amazon', $t$Use Best Sellers Rank, ratings, search behaviour and Amazon's own research tools to estimate demand responsibly.$t$, 'article', 1, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Amazon does not publish exact sales figures for products, so every seller works with estimates. Your goal is not to find a perfect number but to gather several independent signals that point in the same direction. If they disagree, treat the idea with caution.</p>
<h2>Best Sellers Rank</h2>
<p>Best Sellers Rank (BSR) shows how a product's recent sales compare with other products in the same category. A lower number means relatively stronger sales. Keep three limits in mind:</p>
<ul>
<li>BSR is relative, not a unit count, and the same rank can mean very different volumes in different categories.</li>
<li>It updates frequently and can jump after a short burst of sales, so look at its history over months rather than a single snapshot.</li>
<li>A product can rank in a main category and in more specific subcategories, so compare like with like.</li>
</ul>
<h2>Ratings and listing history</h2>
<p>The number of ratings, and how quickly they accumulate, gives a rough sense of how long a product has been selling and how strongly. An old listing with few ratings may sell slowly, while several newer listings gaining ratings steadily can indicate growing demand. Only a fraction of buyers leave ratings, so never treat them as a direct sales count.</p>
<h2>Search behaviour</h2>
<p>Demand ultimately comes from what customers type into the search bar.</p>
<ul>
<li>Use Amazon's search suggestions to see how shoppers phrase a need.</li>
<li>Look at how many relevant results appear and how many are sponsored placements.</li>
<li>If your account has access, use Product Opportunity Explorer in Seller Central, which groups products into niches and shows search and sales trends based on Amazon data. Availability varies by marketplace.</li>
<li>Later, once your brand qualifies, use Amazon's brand analytics and search query reports.</li>
</ul>
<h2>Third-party research tools</h2>
<p>Many paid tools estimate monthly sales and keyword search volume. They can save time, but they model data rather than read it directly, and different tools often give different numbers for the same product. Use them to compare products against each other, not as precise forecasts.</p>
<h3>Demand research steps</h3>
<ol>
<li>Search your main keyword and list the top ten organic results.</li>
<li>Record each product's price, BSR, rating count and approximate listing age.</li>
<li>Look at BSR history over at least several months to spot seasonality.</li>
<li>Check two or three related search phrases to understand the size of the niche.</li>
<li>Compare your notes with any tool estimates and record the most conservative figure.</li>
</ol>
<h3>Try this</h3>
<p>Run the five steps above for one product idea and summarise demand in a single sentence, such as "steady year-round demand spread across many sellers" or "seasonal demand concentrated in two brands". That sentence will feed into your product scorecard in the last lesson of this module.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Analysing competition and finding your point of difference', $t$Mine reviews and compare listings to find a realistic way to stand out without copying anyone.$t$, 'article', 2, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Demand tells you customers want a product. Competition analysis tells you whether you can realistically win some of those sales. A good opportunity usually combines steady demand with competitors who leave clear gaps: weak listings, recurring complaints or a type of customer nobody serves well.</p>
<h2>Sizing up the competition</h2>
<p>For your top ten search results, look beyond price and ratings:</p>
<ul>
<li><strong>Who is selling:</strong> major brands, Amazon itself, or many small sellers with similar products.</li>
<li><strong>Listing quality:</strong> blurry images, thin bullet points or missing information suggest room to compete on presentation.</li>
<li><strong>Price clustering:</strong> if most listings sit in a narrow price band, entering far below it may squeeze your margin, and entering far above it needs a clear reason.</li>
<li><strong>Review barriers:</strong> if every top listing has a very large number of ratings, earning visibility may take a long time and a large advertising budget.</li>
<li><strong>Sponsored density:</strong> many ads at the top of the results usually means competitive, more expensive advertising.</li>
</ul>
<h2>Mining reviews for product improvements</h2>
<p>Customer reviews are free market research. Read the critical reviews (one to three stars) for the leading products and group complaints into themes, such as durability, sizing, missing accessories, confusing instructions or poor packaging. Then read the positive reviews to learn which features customers value most and must not be removed.</p>
<p>Count how often each complaint appears. A problem mentioned once is an anecdote; a problem mentioned across several competing products is an opportunity.</p>
<h2>Choosing a realistic differentiator</h2>
<p>Your point of difference should be something customers notice, your supplier can produce consistently and your margin can absorb. Examples include stronger materials, a size competitors do not offer, a more useful accessory, clearer instructions or packaging that protects the product better.</p>
<p>Avoid two common mistakes. First, do not copy a competitor's design, branding or images, because protected designs and trademarks can lead to infringement complaints. Second, do not bundle unrelated items just to look different; bundles add cost and complexity without solving a real customer problem.</p>
<h3>Competition analysis checklist</h3>
<ul>
<li>List the top ten results with seller type, price and rating count.</li>
<li>Score each listing's images, title and bullet points on a simple one-to-five scale.</li>
<li>Group critical review comments into themes and count them.</li>
<li>Write down one to three improvements that solve the most common complaints.</li>
<li>Confirm with a supplier that each improvement is feasible, and estimate its cost.</li>
</ul>
<h3>Try this</h3>
<p>Read at least thirty critical reviews across three competing products in your chosen niche. Write down your top three complaint themes and one realistic product improvement for each.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Validating a product idea before you commit', $t$Combine demand, competition and unit economics in a scorecard and decide whether to proceed, adjust or walk away.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Validation is the step where you decide, with evidence, whether an idea deserves your money. It brings together everything from this module and the unit economics from Module 1. The aim is a clear decision: proceed, adjust the idea or walk away. Walking away from a weak idea is a good outcome, because it protects your capital for a better one.</p>
<h2>Build a product scorecard</h2>
<p>A scorecard keeps your decisions consistent. Create a spreadsheet with one row per idea and score each criterion from one to five:</p>
<ul>
<li>Demand strength and stability across the year.</li>
<li>Competition level and how beatable the top listings are.</li>
<li>Clarity and feasibility of your point of difference.</li>
<li>Projected margin and return on investment.</li>
<li>Compliance and restriction risk, where a higher score means lower risk.</li>
<li>Logistics simplicity: size, weight, fragility and prep.</li>
</ul>
<p>Decide your minimum total score in advance, and set any non-negotiable rules, such as "no dangerous goods" or "the margin must stay positive under a stress test".</p>
<h2>Stress-test the numbers</h2>
<p>Your first calculation is usually optimistic. Re-run your unit economics with less favourable assumptions:</p>
<ul>
<li>A lower sale price, because competitors may cut prices or you may need launch discounts.</li>
<li>A higher advertising cost per unit during the launch period.</li>
<li>Higher freight costs or a longer lead time.</li>
<li>Slower sales, which increase storage cost per unit.</li>
</ul>
<p>If the product only works in the best-case scenario, it is a fragile opportunity.</p>
<h2>Check for legal and practical blockers</h2>
<p>Before committing, search the official patent and trademark databases for your target country, and consider speaking to an IP professional if your product is close to an existing design. Confirm that suppliers can make your improved version at the cost you assumed, and that their minimum order quantity fits your budget.</p>
<h3>Validation steps</h3>
<ol>
<li>Score each idea on your scorecard.</li>
<li>Run base-case and stress-case unit economics.</li>
<li>Check eligibility, compliance and intellectual property.</li>
<li>Get at least indicative quotes from two or three suppliers.</li>
<li>Decide whether to proceed, adjust or drop the idea, and write down the reason.</li>
<li>If you proceed, plan a modest first order rather than spending your full budget.</li>
</ol>
<h3>Try this</h3>
<p>Score three product ideas on your scorecard, including the stress-tested margin. Rank them and write two sentences explaining why your top idea beat the others. If none clears your minimum score, that is useful information: go back to research with refined criteria.</p>$h$));

  ---------------------------------------------------------------------------
  -- Module 3
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Sourcing and suppliers', $t$Find and vet suppliers, manage samples and quality, and calculate the true landed cost of your product.$t$, 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Where to find suppliers', $t$Understand the types of suppliers available and the sourcing channels each business model uses.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your supplier influences your product quality, cash flow, lead times and ultimately your reviews. Finding a good one is less about luck and more about searching in the right places, understanding who you are dealing with and comparing several options before you choose.</p>
<h2>Types of suppliers</h2>
<ul>
<li><strong>Manufacturers</strong> make the product in their own factory. They may offer better pricing and more control over specifications, but often have higher minimum order quantities (MOQs).</li>
<li><strong>Trading companies</strong> source from factories on your behalf. They can be easier to work with, handle several product types and accept smaller orders, but they add a margin and may have less direct control over production.</li>
<li><strong>Brand owners and authorised distributors</strong> supply branded goods to wholesale sellers. They are the source you need when reselling established brands.</li>
</ul>
<p>Neither manufacturers nor trading companies are automatically better. What matters is transparency, consistent quality and reliable communication.</p>
<h2>Sourcing channels</h2>
<h3>For private label</h3>
<ul>
<li><strong>B2B marketplaces:</strong> large online directories where you can search for manufacturers by product, compare profiles and send enquiries.</li>
<li><strong>Trade shows:</strong> in-person or virtual events where you can meet suppliers, handle samples and build relationships quickly.</li>
<li><strong>Domestic manufacturers:</strong> often higher unit costs, but shorter lead times, easier communication and simpler logistics.</li>
<li><strong>Sourcing agents:</strong> independent professionals who find and manage suppliers for a fee. Check their references carefully.</li>
</ul>
<h3>For wholesale</h3>
<ul>
<li>Contact brands directly and ask about their distribution and online reseller policies.</li>
<li>Use trade directories and industry associations to identify authorised distributors.</li>
<li>Attend industry trade shows where brands recruit retail partners.</li>
</ul>
<p>Whatever the channel, wholesale sellers should keep invoices that show a traceable supply chain, because Amazon may request them to confirm authenticity.</p>
<h2>Making your first shortlist</h2>
<p>Aim to contact several potential suppliers for each product, then narrow them to a shortlist of two or three. Judge them on how well they answer questions, not only on price. A supplier who responds clearly, asks about your specifications and is open about their capabilities is often a better partner than the cheapest quote.</p>
<h3>Supplier search checklist</h3>
<ol>
<li>Define your product specification before contacting anyone.</li>
<li>Search at least two sourcing channels.</li>
<li>Record each supplier's type, location, years in business and product focus.</li>
<li>Note whether they have experience supplying sellers in your target country.</li>
<li>Shortlist suppliers on communication, capability and price together.</li>
</ol>
<h3>Try this</h3>
<p>Set up a supplier tracking spreadsheet with columns for supplier name, type, channel, contact, MOQ, indicative price, lead time and notes. Add at least five potential suppliers for your top product idea.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Vetting suppliers and requesting quotes', $t$Write a clear request for quotation, compare offers fairly and spot the warning signs of an unreliable supplier.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A clear request for quotation (RFQ) saves you weeks of back-and-forth and makes supplier quotes comparable. Vetting then confirms that a supplier is genuine, capable and a good fit before you send any money.</p>
<h2>What to include in your request for quotation</h2>
<ul>
<li><strong>Product specification:</strong> materials, dimensions, colours, weight, finish and the features that make your version different. Include reference photos or drawings.</li>
<li><strong>Quantities:</strong> ask for pricing at two or three order sizes so you understand how the unit price changes with volume.</li>
<li><strong>Packaging:</strong> retail packaging, inserts, labelling and carton requirements, including any Amazon prep needs.</li>
<li><strong>Compliance:</strong> the standards, testing and markings required in your destination market.</li>
<li><strong>Commercial terms:</strong> lead time, sample cost, payment terms and the shipping term (Incoterm) you want quoted.</li>
</ul>
<p>Send the same RFQ to every supplier so you can compare like with like.</p>
<h2>Comparing quotes</h2>
<p>The lowest unit price is not always the cheapest option. Compare quotes on:</p>
<ul>
<li>Total cost at your intended order quantity, including packaging, tooling or mould fees and sample costs.</li>
<li>What the price includes, such as delivery to a port or collection from the factory door.</li>
<li>Production lead time and how it fits your launch plan.</li>
<li>Payment terms. A common structure is a deposit before production and the balance before shipment, but terms vary.</li>
</ul>
<h2>Vetting a supplier</h2>
<h3>Positive signs</h3>
<ul>
<li>Clear, specific answers to technical questions.</li>
<li>Willingness to share business registration details and, where relevant, factory audit or certification reports.</li>
<li>Experience producing similar products and exporting to your market.</li>
<li>A reasonable sample policy and transparent pricing.</li>
</ul>
<h3>Warning signs</h3>
<ul>
<li>Prices far below every other quote without an explanation.</li>
<li>Pressure to pay quickly, or to pay a bank account in a different company name from the supplier.</li>
<li>Vague answers about materials, testing or production capacity.</li>
<li>Reluctance to put agreed specifications in writing.</li>
</ul>
<p>Pay using methods that offer some protection or traceability, confirm bank details through a second channel before any payment, and record everything you agree in a written purchase order.</p>
<h3>Vetting steps</h3>
<ol>
<li>Send a consistent RFQ to your shortlisted suppliers.</li>
<li>Compare total cost, terms and lead times side by side.</li>
<li>Verify each supplier's business details independently.</li>
<li>Ask follow-up questions to test knowledge and responsiveness.</li>
<li>Choose two or three suppliers to request samples from.</li>
</ol>
<h3>Try this</h3>
<p>Draft a one-page RFQ for your top product idea using the headings in this lesson. Ask someone else to read it and tell you whether anything is unclear. If they are unsure, a supplier will be too.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Samples, quality control and product compliance', $t$Evaluate samples, set a quality standard and use inspections and testing to protect your reviews and your account.$t$, 'article', 2, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Quality problems on Amazon are expensive. They lead to returns, negative reviews, account health issues and sometimes listing removals. A structured approach to samples and quality control is one of the cheapest forms of insurance available to you.</p>
<h2>Evaluating samples</h2>
<p>Order samples from two or three suppliers and test them as a customer would. Use the product, measure it, check the finish, try to break it and compare it against the complaints you found in competitor reviews. Photograph and note everything.</p>
<ul>
<li>Does it match your specification exactly?</li>
<li>Does it solve the problems customers complained about?</li>
<li>How does it survive drops, packing and repeated use?</li>
<li>Is the packaging strong enough to protect it in fulfilment centres?</li>
</ul>
<p>When you have chosen a supplier, approve a final reference sample, often called a <em>golden sample</em>. Keep one yourself and ask the supplier to keep one too. It becomes the standard every production unit is measured against.</p>
<h2>Quality control during and after production</h2>
<h3>Written specifications</h3>
<p>Put specifications, tolerances, packaging and labelling requirements in your purchase order. Disputes are much easier to resolve when expectations are documented.</p>
<h3>Pre-shipment inspection</h3>
<p>Many sellers hire an independent inspection company to check goods at the factory when production is complete or nearly complete. Inspectors typically check a random sample of units against an Acceptable Quality Limit (AQL) standard, which sets how many defects are acceptable in a sample of a given size. You agree the AQL levels and checklist in advance, then decide whether to release payment and shipment based on the report.</p>
<h2>Product compliance and testing</h2>
<p>Depending on your product and market, you may need laboratory testing, certificates of conformity, specific warning labels, country-of-origin markings or registration with a regulator. Children's products, electrical goods, cosmetics and items that touch food are common examples with strict rules. Research the requirements for your destination country through official government sources, and use accredited testing laboratories where testing is required.</p>
<p>Keep compliance documents organised and accessible, because Amazon may request them before or after your product goes live.</p>
<h3>Quality control checklist</h3>
<ol>
<li>Order and test samples from more than one supplier.</li>
<li>Approve and keep a golden sample.</li>
<li>Document specifications, tolerances and packaging in the purchase order.</li>
<li>Arrange any required testing before mass production.</li>
<li>Book a pre-shipment inspection with an agreed AQL and checklist.</li>
<li>Release the balance payment only when the inspection result is acceptable.</li>
</ol>
<h3>Try this</h3>
<p>Create a one-page inspection checklist for your product covering appearance, dimensions, function, packaging and labelling. Include at least three checks based on the competitor complaints you found in Module 2.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Shipping terms, freight and landed cost', $t$Understand Incoterms, freight options and import responsibilities so you can calculate your true cost per unit.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Getting your product from the factory to an Amazon fulfilment centre involves several handovers, each with its own costs and responsibilities. Understanding them lets you choose the right shipping method, avoid surprise charges and calculate an accurate landed cost.</p>
<h2>Incoterms in plain language</h2>
<p>Incoterms are standard trade terms published by the International Chamber of Commerce. They define where responsibility and cost pass from the seller of the goods to the buyer. Confirm which version your contract refers to. Three terms you will meet often are:</p>
<ul>
<li><strong>EXW (Ex Works):</strong> you, the buyer, take responsibility from the supplier's premises. It looks cheap but leaves you to arrange almost everything, including export formalities.</li>
<li><strong>FOB (Free On Board):</strong> the supplier delivers the goods loaded on board the vessel at the named port of export. You arrange and pay for the main sea freight from there. It is a common choice for sea shipments.</li>
<li><strong>DDP (Delivered Duty Paid):</strong> the supplier delivers to your named destination with import duties paid. It is simple, but you have less visibility of costs and must check who is legally acting as the importer.</li>
</ul>
<h2>Freight options</h2>
<ul>
<li><strong>Express courier:</strong> fastest and simplest for samples and small shipments, but expensive per unit.</li>
<li><strong>Air freight:</strong> faster than sea and suitable for urgent, high-value or lightweight goods.</li>
<li><strong>Sea freight:</strong> slowest but usually cheapest per unit for larger volumes, either sharing a container (LCL) or using a full container (FCL).</li>
</ul>
<p>A freight forwarder can arrange transport, documentation and customs clearance. Ask for quotes that clearly show every charge from collection to delivery.</p>
<h2>Importing responsibilities</h2>
<p>Someone must act as the importer of record, responsible for customs declarations and for paying duties and taxes. Amazon does not act as your importer, so you will need a forwarder or customs broker to handle clearance on behalf of you or your business. Depending on your destination, you may also need registrations such as an importer or customs number, or a customs bond. Check the official customs authority guidance for your destination country.</p>
<h2>Calculating landed cost</h2>
<p><code>Landed cost per unit = (product cost + packaging + inspection + freight + duties and taxes + customs and broker fees + delivery to Amazon) / number of sellable units</code></p>
<p>Divide by the number of sellable units, not the number ordered, so defects and samples are accounted for.</p>
<h3>Shipping checklist</h3>
<ol>
<li>Agree the Incoterm with your supplier in writing.</li>
<li>Get at least two freight quotes for the same shipment.</li>
<li>Confirm the duty rate using your product's tariff classification.</li>
<li>Arrange customs clearance and any importer registrations.</li>
<li>Calculate landed cost and update your unit economics.</li>
<li>Add transit and customs time to your total lead time.</li>
</ol>
<h3>Try this</h3>
<p>Using a supplier's indicative quote and one freight quote, calculate the landed cost per unit for your top product. Compare it with the estimate you used during validation and note the difference.</p>$h$));

  ---------------------------------------------------------------------------
  -- Module 4
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Listings, FBA logistics and inventory', $t$Create a strong listing, prepare and send inventory to Amazon, and plan stock levels with confidence.$t$, 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Product identifiers and creating your listing', $t$Understand ASINs, GTINs and Brand Registry, and choose between creating a new listing and matching an existing one.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Every product on Amazon lives on a product detail page identified by an ASIN (Amazon Standard Identification Number). Sellers either create a new ASIN or add their offer to an existing one. Getting identifiers and listing structure right from the start avoids suppressed listings and messy fixes later.</p>
<h2>GTINs and product barcodes</h2>
<p>To create most new listings, Amazon asks for a Global Trade Item Number (GTIN), such as a UPC or EAN. Amazon checks GTINs against the database of GS1, the organisation that manages these barcodes, so the safest route is to license barcodes directly from GS1 in your country. Cheap barcodes resold by third parties may not be registered to your brand and can lead to listing problems.</p>
<p>Some brands and product types can apply for a GTIN exemption. Check the current exemption criteria in Seller Central if your product does not carry a barcode.</p>
<h2>New listing or existing listing?</h2>
<ul>
<li><strong>Private label:</strong> you create a new ASIN for your branded product. You control the content, especially once your brand is enrolled in Brand Registry.</li>
<li><strong>Wholesale and arbitrage:</strong> you usually add your offer to the existing ASIN for that exact product. Never create a duplicate listing for a product that already exists, because it breaks Amazon's policies.</li>
</ul>
<h2>Variations</h2>
<p>If your product comes in several sizes or colours, a parent-child variation family groups them on one page. Variations must be genuine versions of the same product. Combining different products into one family to share reviews is against Amazon's rules.</p>
<h2>Brand Registry</h2>
<p>Amazon Brand Registry is a programme for brand owners with an eligible trademark. Benefits typically include more control over listing content, access to A+ Content and brand stores, additional advertising formats, brand analytics and tools to report infringement. Check the current eligibility rules and benefits on Amazon's Brand Registry pages.</p>
<h3>Listing creation steps</h3>
<ol>
<li>Search the catalogue to confirm whether your product already exists.</li>
<li>Obtain a GS1 barcode or confirm that you are eligible for an exemption.</li>
<li>In Seller Central, open the tool for adding a product and choose the correct product type.</li>
<li>Enter the required attributes, such as brand, dimensions, materials and compliance details.</li>
<li>Set the fulfilment channel to FBA and enter your SKU, price and condition.</li>
<li>Fix any errors or missing information that stop the listing going live.</li>
<li>Review the live page on both desktop and mobile.</li>
</ol>
<h3>Choosing a SKU format</h3>
<p>Your SKU (stock keeping unit) is your own internal code. Make it readable, for example by combining a product code, colour and size, so your records stay clear as your range grows.</p>
<h3>Try this</h3>
<p>Search the Amazon catalogue for your product idea and record whether an identical product already exists. Then write a SKU naming convention for your future range, with examples for at least three variations.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Writing a listing that converts', $t$Write titles, bullet points, descriptions and images that help shoppers find, understand and choose your product.$t$, 'article', 1, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your listing does two jobs. It helps Amazon's search understand when to show your product, and it persuades shoppers to buy once they see it. Both depend on clear, accurate content built around how customers search and what they care about.</p>
<h2>Keyword research</h2>
<p>Start with the language your customers use. Collect phrases from search suggestions, competitor titles, customer reviews and, once available, your advertising search term reports. Group them into primary phrases (the core product), secondary phrases (features, materials and sizes) and use-case phrases (who it is for and when they use it).</p>
<h2>The main listing elements</h2>
<h3>Title</h3>
<p>Follow the style guide for your category. A typical structure is brand, product type, key feature or material, size or quantity, and colour where relevant. Avoid promotional phrases, excessive capitals and lists of keywords. Amazon enforces limits on title length and characters, so check the current requirements for your category.</p>
<h3>Bullet points</h3>
<p>Use each bullet point for one benefit, backed by a concrete feature. Lead with what matters most to the customer, and answer the questions you found in reviews: size, compatibility, materials, care and what is in the box.</p>
<h3>Description and A+ Content</h3>
<p>The product description adds detail. If your brand is enrolled in Brand Registry, A+ Content lets you use structured modules with images and comparison charts. Use it to explain the product more fully, not to repeat the bullet points.</p>
<h3>Backend search terms</h3>
<p>Seller Central lets you add hidden search terms. Use them for synonyms and alternative spellings that do not fit naturally in your visible content. Do not include competitor brand names, repeated words or misleading terms, and stay within the current size limit.</p>
<h2>Images</h2>
<p>Images often decide whether a shopper clicks and buys. The main image must follow Amazon's main image rules, which generally require a pure white background, the actual product filling most of the frame and no added text or graphics. Secondary images can show the product in use, its scale, key features and dimensions. Use high-resolution images that are large enough to support zoom.</p>
<h3>Listing quality checklist</h3>
<ul>
<li>The title follows the category style guide and includes your primary phrase.</li>
<li>Each bullet point states one clear benefit with supporting detail.</li>
<li>Every claim is accurate and can be substantiated.</li>
<li>The main image complies with the current image requirements.</li>
<li>Secondary images answer common customer questions visually.</li>
<li>Backend search terms contain no duplicates or competitor brands.</li>
<li>You have checked the listing on a mobile device.</li>
</ul>
<h3>Try this</h3>
<p>Draft a title and five bullet points for your product. Then list the top five questions or complaints from competitor reviews and check that your bullet points answer each one.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Preparing and sending inventory to FBA', $t$Learn how to prep, label and pack your products and create a shipment that Amazon receives without problems.$t$, 'article', 2, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Inventory that arrives poorly prepared or labelled can be delayed, charged extra fees, refused or disposed of. A careful first shipment teaches you the process and sets up good habits for every shipment after it.</p>
<h2>Packaging and prep requirements</h2>
<p>Amazon publishes packaging and prep requirements for FBA, organised by product type. Common examples include:</p>
<ul>
<li>Placing loose or easily soiled items in sealed poly bags, which may need a suffocation warning depending on their size.</li>
<li>Protecting fragile items so they survive handling and drops.</li>
<li>Marking items that are sold as a set so they are not separated.</li>
<li>Covering old or extra barcodes so only the correct barcode can be scanned.</li>
</ul>
<p>The requirements are detailed and change over time, so read the current pages in Seller Central for your product type and share them with your supplier. Many sellers ask the factory to complete prep and labelling before goods leave.</p>
<h2>Product labels and barcodes</h2>
<p>Amazon must be able to identify which seller owns each unit. Depending on the product and your settings, units are tracked either by the manufacturer barcode or by an Amazon barcode, often called an FNSKU label, that is specific to your offer. Private label sellers commonly use Amazon barcodes so their units are tracked to their account. Amazon's rules on barcode tracking have changed over time, so check the current policy before you decide.</p>
<h2>Creating a shipment</h2>
<p>In Seller Central, the shipment creation workflow guides you through a sequence of steps. Menus and names change, but the logic stays similar:</p>
<ol>
<li>Choose the inventory to send and confirm quantities.</li>
<li>Enter box contents, carton weights and dimensions.</li>
<li>Choose from the placement options Amazon offers. Options can differ in how many fulfilment centres you ship to and in the fees charged.</li>
<li>Select a carrier, which may include Amazon's partnered carrier programme where available.</li>
<li>Print box labels and apply them as instructed, one per carton and not over seams.</li>
<li>Mark the shipment as shipped and add tracking details.</li>
</ol>
<p>Cartons must also meet Amazon's weight and size limits, so share these with your supplier or freight forwarder before goods are packed.</p>
<h2>After the shipment arrives</h2>
<p>Monitor the shipment status as it is received. If received quantities do not match what you sent, investigate promptly using your packing lists and proof of delivery, and use the reconciliation options in Seller Central within the time allowed.</p>
<h3>First shipment checklist</h3>
<ul>
<li>Read the current prep and labelling requirements for your product type.</li>
<li>Confirm the barcode type and label every unit correctly.</li>
<li>Check carton weight and size limits.</li>
<li>Record box contents accurately.</li>
<li>Keep packing lists, photos and tracking numbers.</li>
</ul>
<h3>Try this</h3>
<p>Write a one-page prep and labelling brief for your supplier covering unit packaging, barcode labels, carton limits and box labels, based on the current requirements for your product type.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Inventory planning and storage management', $t$Calculate reorder points, avoid stockouts and keep slow-moving inventory from eating into your profit.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Inventory is where many FBA businesses win or lose. Too little stock and you lose sales, search ranking momentum and advertising efficiency. Too much and you pay storage fees and surcharges, and you tie up cash that could fund growth. Planning turns these risks into routine decisions.</p>
<h2>Know your total lead time</h2>
<p>Your lead time is the full time from placing a purchase order to having units available for sale on Amazon. It includes production, inspection, transit, customs clearance, delivery to the fulfilment centre and Amazon's receiving time. Track each stage for every order, because peak seasons can lengthen several of them at once.</p>
<h2>Calculating a reorder point</h2>
<p>A reorder point tells you when to place your next order:</p>
<p><code>Reorder point = average daily unit sales x total lead time in days + safety stock</code></p>
<p>Safety stock covers surprises such as a sales spike or a delayed vessel. A simple approach is to hold extra days of sales that reflect the delays you have actually experienced. For example, if your total lead time is 60 days, you reorder when your available and inbound stock falls to about 60 days of sales plus your safety buffer.</p>
<h2>Amazon's inventory rules</h2>
<p>Amazon manages fulfilment centre space using capacity limits and inventory performance measures. These can limit how much you can send in, and they reward sellers who keep sell-through healthy and avoid excess or stranded stock. Review the inventory and capacity sections of Seller Central regularly, and check the current rules before planning large shipments, particularly before the peak season.</p>
<h2>Dealing with problem inventory</h2>
<ul>
<li><strong>Stranded inventory:</strong> units in a fulfilment centre without an active offer. Fix the listing issue or remove the units.</li>
<li><strong>Aged inventory:</strong> units stored for a long time can attract surcharges. Consider price reductions, promotions or removal before the charges grow.</li>
<li><strong>Excess inventory:</strong> more stock than you can sell in a reasonable period. Slow future orders, run promotions or create removal orders.</li>
</ul>
<h3>Seasonality and peak season</h3>
<p>If your product sells more at certain times of year, plan orders months ahead and allow for longer receiving times during peak periods. Storage fees are often higher in the final quarter of the year, so avoid sending stock that will not sell in that window.</p>
<h3>Weekly inventory routine</h3>
<ol>
<li>Record available, inbound and reserved units.</li>
<li>Update your average daily sales from the last 30 days.</li>
<li>Compare your stock against your reorder point.</li>
<li>Check for stranded, aged or excess inventory and act on it.</li>
<li>Review capacity limits before creating new shipments.</li>
</ol>
<h3>Try this</h3>
<p>Build a reorder point calculator in your spreadsheet with inputs for daily sales, each lead-time stage and safety days. Test it with slow, expected and fast sales scenarios for your product.</p>$h$));

  ---------------------------------------------------------------------------
  -- Module 5
  ---------------------------------------------------------------------------
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Launch and scale', $t$Launch your product within Amazon's rules, measure what matters and grow at a sustainable pace.$t$, 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Launching your product: reviews, advertising and pricing', $t$Plan a compliant launch using legitimate review programmes, structured Sponsored Products campaigns and sensible pricing.$t$, 'article', 0, 14, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A new listing starts with no sales history, no reviews and little visibility. Your launch plan should build all three steadily without breaking Amazon's rules. Shortcuts here, especially around reviews, are one of the fastest ways to lose a listing or an account.</p>
<h2>Reviews: what is allowed and what is not</h2>
<p>Amazon strictly prohibits review manipulation. You must not pay for reviews, offer refunds, discounts, gifts or other incentives in exchange for reviews, ask friends or family to review your product, or ask only satisfied customers to leave reviews. Legitimate options include:</p>
<ul>
<li>Using the request-a-review function in Seller Central, which sends a standard, neutral request to the buyer.</li>
<li>Enrolling eligible products in Amazon Vine, a programme in which Amazon invites selected reviewers to post honest opinions. Eligibility and any enrolment fees vary, so check the current details.</li>
<li>Including a neutral insert that explains how to get support, without asking for positive reviews or offering anything in return.</li>
</ul>
<p>The most reliable way to earn good reviews is a product that solves the problems competitors leave unsolved.</p>
<h2>Sponsored Products basics</h2>
<p>Sponsored Products ads appear in search results and on product pages, and you pay when a shopper clicks. A simple launch structure is:</p>
<ol>
<li><strong>An automatic campaign</strong> that lets Amazon match your ad to relevant searches. It helps you discover search terms.</li>
<li><strong>A manual keyword campaign</strong> targeting your most relevant phrases with exact and phrase match.</li>
<li><strong>A manual product targeting campaign</strong> showing your ad on relevant competitor or complementary product pages.</li>
</ol>
<p>Review search term reports weekly. Move converting search terms into manual campaigns, and add irrelevant or unprofitable terms as negative keywords.</p>
<h3>Key advertising metrics</h3>
<ul>
<li><strong>ACOS</strong> (advertising cost of sales): ad spend divided by ad-attributed sales.</li>
<li><strong>TACoS</strong> (total advertising cost of sales): ad spend divided by total sales, showing how dependent you are on ads.</li>
<li><strong>Break-even ACOS:</strong> your profit margin before advertising. Above it, ad-driven sales lose money.</li>
</ul>
<p>During launch, many sellers accept a higher ACOS for a limited time to build sales history. Set that limit and the time frame in advance.</p>
<h2>Launch pricing</h2>
<p>Price within the range customers expect for comparable products. Coupons and promotions can help early conversion, but check your margin with every discount combined, and avoid prices you cannot sustain.</p>
<h3>Launch checklist</h3>
<ul>
<li>The listing is complete, compliant and checked on mobile.</li>
<li>You hold enough inventory to cover launch demand plus your reorder lead time.</li>
<li>Your advertising budget, target ACOS and time limit are agreed.</li>
<li>Review requests and any Vine enrolment are planned within the rules.</li>
</ul>
<h3>Try this</h3>
<p>Calculate your break-even ACOS from your unit economics. Then write a 30-day launch plan with a daily ad budget, a maximum launch ACOS and the date you will review results.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Measuring performance and scaling sustainably', $t$Track account health and business metrics, decide what to improve and grow your range without overstretching your cash flow.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once your product is selling, your job shifts from launching to managing. Growth comes from protecting your account, improving what works and reinvesting carefully. This lesson gives you a simple routine for each.</p>
<h2>Protecting account health</h2>
<p>The Account Health page in Seller Central summarises how Amazon views your performance. It covers customer service measures such as the order defect rate, policy compliance items such as intellectual property complaints and product safety or authenticity issues, and listing policy warnings. Amazon publishes target levels for these metrics, so check the current targets on the page itself.</p>
<p>Check Account Health at least weekly. Respond to any warning or document request promptly, keep supplier invoices and compliance documents available, and take quality complaints seriously, because they often signal a problem you can fix at the source.</p>
<h2>Business metrics that guide decisions</h2>
<ul>
<li><strong>Sessions:</strong> visits to your product page, a measure of traffic.</li>
<li><strong>Unit session percentage:</strong> units ordered divided by sessions, a measure of conversion.</li>
<li><strong>Profit after all fees and advertising:</strong> the number that actually matters, tracked monthly.</li>
<li><strong>Return rate and reasons:</strong> a direct line to product or listing problems.</li>
<li><strong>Days of inventory cover:</strong> how long current stock will last at recent sales speed.</li>
</ul>
<p>Use these together. Low traffic suggests a visibility problem, such as keywords or advertising. Good traffic with low conversion points to price, images, reviews or listing content.</p>
<h2>Scaling sustainably</h2>
<h3>Improve before you expand</h3>
<p>Before adding products, make sure your first product is profitable, reliably in stock and supported by a stable advertising structure. Improvements to images, bullet points or the product itself often pay back faster than a new launch.</p>
<h3>Grow your range</h3>
<p>Good next products are often complementary items your customers already buy, or variations that reviews show customers want. Run each new idea through the same validation process from Module 2.</p>
<h3>Manage cash flow</h3>
<p>Inventory orders, freight and advertising usually need paying well before sales arrive. Forecast your cash needs for each purchase order, keep a reserve for unexpected costs, and avoid funding growth in a way that would force you to sell at a loss if sales slow down.</p>
<h3>Weekly review routine</h3>
<ol>
<li>Check Account Health and resolve any issues.</li>
<li>Review sessions, conversion and profit by product.</li>
<li>Read new reviews and return reasons.</li>
<li>Optimise advertising using search term data.</li>
<li>Update inventory levels and reorder points.</li>
<li>Choose one improvement to test in the coming week.</li>
</ol>
<h3>Try this</h3>
<p>Create a one-page weekly dashboard in your spreadsheet covering account health status, sessions, conversion, profit, ad spend and days of inventory cover. Fill it in with sample numbers so it is ready to use from your first week of sales.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$In the FBA model, which of these tasks does Amazon handle for FBA orders?$t$, $t$With FBA, Amazon stores your inventory, picks, packs and ships orders, and handles most customer service and returns for those orders. Choosing products, sourcing them and making sure they comply with the law remain your responsibility.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Storing inventory, and picking, packing and shipping orders$t$, true, 0),
    (qq, $t$Choosing which products you sell$t$, false, 1),
    (qq, $t$Making sure your product complies with safety laws$t$, false, 2),
    (qq, $t$Negotiating prices with your supplier$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Best Sellers Rank tells you exactly how many units a product sold last month.$t$, $t$False. Best Sellers Rank is a relative ranking of recent sales within a category and is updated frequently. It is not a unit count, and the same rank can mean very different volumes in different categories.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, 'True', false, 0),
    (qq, 'False', true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of these costs belong in your landed cost per unit? Select all that apply.$t$, $t$Landed cost covers everything needed to get a sellable unit to Amazon, including product cost, packaging, inspection, freight, duties and customs fees. The referral fee is an Amazon selling fee charged when the item sells, so it belongs elsewhere in your unit economics.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Freight and shipping costs$t$, true, 0),
    (qq, $t$Import duties and customs fees$t$, true, 1),
    (qq, $t$Pre-shipment inspection costs$t$, true, 2),
    (qq, $t$The Amazon referral fee$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which of these is a compliant way to get reviews for a new product?$t$, $t$The request-a-review function sends a standard, neutral request and is allowed. Offering refunds for reviews, asking friends and family, and asking only happy customers are all forms of review manipulation that Amazon prohibits.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Using the request-a-review function in Seller Central$t$, true, 0),
    (qq, $t$Offering a refund to buyers who leave a five-star review$t$, false, 1),
    (qq, $t$Asking friends and family to buy and review the product$t$, false, 2),
    (qq, $t$Sending review requests only to customers who seem happy$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What does ACOS measure?$t$, $t$ACOS (advertising cost of sales) is ad spend divided by the sales attributed to those ads. Ad spend divided by total sales is TACoS, which shows how dependent your overall sales are on advertising.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Ad spend divided by ad-attributed sales$t$, true, 0),
    (qq, $t$Ad spend divided by total sales$t$, false, 1),
    (qq, $t$Units ordered divided by sessions$t$, false, 2),
    (qq, $t$Profit divided by landed cost$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Under the FOB (Free On Board) Incoterm, who typically arranges and pays for the main sea freight?$t$, $t$Under FOB, the supplier delivers the goods loaded on board the vessel at the named port of export. From that point, you as the buyer arrange and pay for the main freight onwards.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$You, as the buyer$t$, true, 0),
    (qq, $t$The supplier$t$, false, 1),
    (qq, $t$Amazon$t$, false, 2),
    (qq, $t$The customs authority$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$You sell an average of 10 units a day, your total lead time is 50 days and you want 10 days of safety stock. What is your reorder point?$t$, $t$Reorder point = daily sales x lead time + safety stock. That is 10 x 50 = 500 units, plus 10 days x 10 units = 100 units of safety stock, giving 600 units.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$600 units$t$, true, 0),
    (qq, $t$500 units$t$, false, 1),
    (qq, $t$510 units$t$, false, 2),
    (qq, $t$60 units$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of these are warning signs when vetting a supplier? Select all that apply.$t$, $t$Pressure to pay a differently named bank account, prices far below every other quote without explanation and reluctance to put specifications in writing are all red flags. A supplier asking detailed questions about your specification is a positive sign.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Pressure to pay into a bank account in a different company name$t$, true, 0),
    (qq, $t$A price far below every other quote with no explanation$t$, true, 1),
    (qq, $t$Reluctance to put agreed specifications in writing$t$, true, 2),
    (qq, $t$Asking detailed questions about your product specification$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Before buying inventory, you should check whether the product is restricted, needs approval or could be classed as dangerous goods.$t$, $t$True. Checking eligibility, approvals, dangerous goods status and compliance requirements before you buy prevents you from holding stock you cannot sell.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, 'True', true, 0),
    (qq, 'False', false, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Your product page gets good traffic but has a low unit session percentage. What should you investigate first?$t$, $t$Unit session percentage measures conversion. Good traffic with weak conversion usually points to what shoppers see on the page: the images, listing content, price or reviews.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Listing content, images, price and reviews$t$, true, 0),
    (qq, $t$Your supplier's payment terms$t$, false, 1),
    (qq, $t$Your monthly storage fees$t$, false, 2),
    (qq, $t$Your reorder point$t$, false, 3);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$Ten questions covering the whole course, from how FBA works to launching and scaling. You need 70% to pass, and you can review the correct answers after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'Product opportunity and launch plan', $h$<p>In this assignment you will apply the whole course to one real product idea. You do not need to buy inventory or open a seller account to complete it. The goal is a clear, evidence-based plan that shows how you would decide whether to launch, and how you would launch within Amazon's rules.</p>
<h2>What to submit</h2>
<p>Submit a document or spreadsheet, or a link to one, containing the following five sections.</p>
<ol>
<li><strong>Product and criteria:</strong> your product idea, the business model you chose and your written product criteria. Explain in two or three sentences why the idea meets them.</li>
<li><strong>Demand and competition research:</strong> a table of the top ten search results for your main keyword showing price, Best Sellers Rank, rating count and seller type; a one-paragraph summary of demand; and the top three complaint themes from competitor reviews, with your proposed improvement for each.</li>
<li><strong>Unit economics:</strong> a per-unit calculation showing sale price, referral fee, FBA fulfilment fee, estimated storage cost, landed cost, advertising cost per unit and a returns allowance. Include a base case and a stress case, state the margin and return on investment for each, and note where you checked current fees.</li>
<li><strong>Sourcing and compliance plan:</strong> your supplier shortlisting criteria, a draft request for quotation, the approvals or compliance documents your product would need and your quality control steps.</li>
<li><strong>Launch plan:</strong> a draft title and five bullet points, your break-even ACOS, a 30-day advertising plan and a reorder point calculation for your first order.</li>
</ol>
<h2>Guidance</h2>
<ul>
<li>Use real data from Amazon's public pages and your own research, and clearly label any figure that is an estimate.</li>
<li>Do not include confidential supplier information you are not permitted to share.</li>
<li>If your research shows the idea is weak, say so and explain why. A well-reasoned decision not to launch can earn full marks.</li>
<li>Keep the submission focused: around four to eight pages, or a spreadsheet with clearly named tabs.</li>
</ul>
<h3>How it will be assessed</h3>
<p>Your submission is graded against the rubric shown with this assignment. You need 60 out of 100 points to pass.</p>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion','Research quality','description',$t$Demand and competition research uses several signals, covers the top results and turns review analysis into specific, feasible product improvements.$t$,'points',30),
        jsonb_build_object('id','c2','criterion','Unit economics','description',$t$The calculation includes all major fee types and landed cost, uses both a base case and a stress case, and draws a sound conclusion from the resulting margin.$t$,'points',30),
        jsonb_build_object('id','c3','criterion','Sourcing and compliance','description',$t$The plan sets realistic supplier criteria, includes a clear request for quotation and identifies the relevant approvals, compliance documents and quality control steps.$t$,'points',20),
        jsonb_build_object('id','c4','criterion','Launch readiness','description',$t$Listing copy is accurate and customer-focused, and the advertising and inventory plans use correct calculations and stay within Amazon's rules.$t$,'points',20)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', $t$Build a product opportunity and launch plan for a real product idea.$t$, 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Bring the whole course together by building a product opportunity and launch plan for a real product idea. Read the instructions and rubric, then submit your work as text, a file or a link.$t$));
end $$;
