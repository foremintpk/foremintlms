-- Foremint Academy course content: E-commerce Business Essentials
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'e-commerce-business-essentials';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'E-commerce Business Essentials',
    short_description = $t$Learn how an online store business really works: choosing a niche and product, pricing for healthy margins, picking a store platform, running fulfilment and returns, serving customers well and reading the metrics that matter. A practical, platform-neutral foundation for anyone planning or running an online shop.$t$,
    description = $h$<p>Selling online is easier to start than ever, but running an online store that makes money still depends on the fundamentals: choosing the right customers and products, pricing for real margins, delivering reliably and treating customers well. This course teaches those fundamentals in a practical, step-by-step way, without hype or shortcuts.</p>
<h2>What you will learn</h2>
<p>You begin by learning how an online store business works as a system. You then choose a niche, validate demand before spending money and compare sourcing models such as making your own products, wholesale, dropshipping and print on demand. In the pricing module you calculate landed cost, gross margin and contribution margin, set prices using cost, value and competitor information, and model discounts and free shipping before you offer them.</p>
<p>Next you compare marketplaces with your own store, weigh hosted and self-hosted platforms, set up payments and checkout trust signals, and review the legal, tax and admin basics every seller should know. The fulfilment module covers fulfilment models, inventory and reorder points, shipping strategy and packaging, and a fair, efficient returns process. Finally, you build customer service routines that earn repeat business and learn the small set of metrics that explains how your store is performing.</p>
<h2>How the course works</h2>
<ul>
<li>Eighteen focused lessons, each ending with a practical "Try this" task that builds your own store plan as you go.</li>
<li>Worked examples with simple numbers you can reproduce in a spreadsheet.</li>
<li>A course quiz to check your understanding of every module.</li>
<li>A practical assignment in which you produce a one-page operating plan for a real or planned store.</li>
</ul>
<h2>Who it is for</h2>
<p>The course is designed for beginners: people planning their first online store, makers and small retailers moving online, and freelancers who support e-commerce clients. It is platform-neutral, so the lessons apply whether you choose Shopify, WooCommerce, another store platform or a marketplace. If you have already decided on Shopify, the Shopify Store Launch course is a natural next step.</p>
<p>Platform fees, tax rules and consumer laws differ by country and change over time. Throughout the course you learn how these work and where to check the current official information, so your decisions stay accurate long after you finish.</p>$h$,
    learning_outcomes = array[
      'Evaluate a niche and validate product demand before investing',
      'Calculate landed cost, gross margin and contribution margin per order',
      'Set prices using cost, customer value and competitor information',
      'Compare marketplaces and store platforms for your business model',
      'Choose a fulfilment model and plan inventory, shipping and returns',
      'Build customer service routines that earn repeat purchases',
      'Track the core metrics of an online store and act on them'
    ],
    requirements = array[
      'No prior business or e-commerce experience is needed',
      'A spreadsheet tool such as Google Sheets or Microsoft Excel',
      'A product idea or an existing store to apply the lessons to',
      'About four to five hours to complete the lessons, quiz and assignment'
    ],
    target_audience = array[
      'Aspiring store owners planning their first online shop',
      'Makers and small retailers moving their sales online',
      'Freelancers and marketers who support e-commerce clients',
      'Existing sellers who want a clearer view of their numbers'
    ],
    tags = array['ecommerce','online-store','small-business','pricing','margins','fulfilment','customer-service','metrics'],
    level = 'beginner',
    estimated_duration_minutes = 257,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = 'E-commerce Business Essentials | Foremint Academy',
    seo_description = 'Learn to run an online store: niche and product choice, pricing and margins, platforms, fulfilment, returns, customer service and key metrics.'
  where id = c;

  -- Module 1
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Choosing your niche and product', 'Decide who you serve and what you sell, then test demand before you commit money.', 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'How an online store business makes money', 'The operating loop of an online store and the costs that sit behind every order.', 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>An online store looks simple from the outside: a website, some products and a checkout button. Behind it sits a business with the same fundamentals as any shop. You buy or make products, attract customers, take payment, deliver orders and handle whatever goes wrong. This lesson gives you a map of that system so the rest of the course has somewhere to fit.</p>
<h2>The operating loop</h2>
<p>Every e-commerce business runs the same loop, whatever it sells:</p>
<ol>
<li><strong>Source</strong> products by making them, buying them wholesale or using a supplier who ships for you.</li>
<li><strong>List</strong> them in a store or marketplace with clear photos, descriptions and prices.</li>
<li><strong>Attract</strong> visitors through search, social media, email, advertising or word of mouth.</li>
<li><strong>Convert</strong> some of those visitors into buyers at checkout.</li>
<li><strong>Fulfil</strong> each order by picking, packing and shipping it.</li>
<li><strong>Support</strong> the customer before and after delivery, including returns.</li>
<li><strong>Retain</strong> happy customers so they buy again.</li>
</ol>
<p>Weakness at any step limits the whole business. Great marketing cannot rescue a product that arrives late or broken, and an excellent product will not sell if nobody finds it.</p>
<h2>Where the money goes</h2>
<p>Revenue is what customers pay you. Profit is what remains after costs, and in e-commerce those costs are spread across many small lines. For each order you typically pay for:</p>
<ul>
<li>The product itself, plus inbound shipping and any import duties.</li>
<li>Packaging and outbound shipping.</li>
<li>Payment processing fees charged by your payment provider.</li>
<li>Platform or marketplace fees.</li>
<li>The marketing you spent to win the sale.</li>
<li>A share of returns, refunds and damaged goods.</li>
</ul>
<p>On top of these per-order costs you carry fixed costs such as software subscriptions, tools, storage and your own time. A store can grow its sales quickly and still lose money if these lines are not understood. That is why Module 2 is dedicated to pricing and margins.</p>
<h2>What you control</h2>
<p>As a beginner, you have the most control over three things: <strong>which customers you serve</strong>, <strong>which products you offer</strong> and <strong>how well you deliver the experience</strong>. Choices made here shape everything else, from your prices to your returns rate. Spend time on them before spending money on stock or advertising.</p>
<h3>Checklist: questions to answer before you build</h3>
<ul>
<li>Who exactly is my customer, and what problem or desire does my product address?</li>
<li>How will I source the product, and what does one unit really cost me?</li>
<li>How will customers find me in the first few months?</li>
<li>How will orders be packed, shipped and returned?</li>
<li>How much time and money can I commit before the store must pay for itself?</li>
</ul>
<h3>Try this</h3>
<p>Draw the seven-step loop on a page and, for each step, write one sentence describing how your store (or planned store) will handle it. Mark any step where your honest answer is "not sure yet". Those are the gaps this course will help you fill, so keep the page and revisit it at the end.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Finding a niche you can serve well', 'Use customer, competition and personal-fit criteria to choose a focused market.', 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A niche is a specific group of customers with shared needs, not just a product category. "Kitchenware" is a category. "Durable, dishwasher-safe kitchen tools for people cooking in small apartments" is a niche. Narrowing your focus can feel risky, but it makes almost every later decision easier: what to stock, how to describe it, where to advertise and how to stand out.</p>
<h2>Why focus beats breadth for a new store</h2>
<p>Large general retailers win on selection, price and delivery speed because they operate at scale. A new store rarely can. You compete instead on fit: understanding a smaller group of customers better than anyone else and curating products, content and service for them. A focused store also needs less inventory and a smaller marketing budget to reach the right people.</p>
<h2>Five criteria for evaluating a niche</h2>
<ol>
<li><strong>Identifiable customers.</strong> Can you describe who buys and where they spend time online? Active communities, forums, hashtags and publications are good signs.</li>
<li><strong>A real need or passion.</strong> People spend more readily on problems that frustrate them or hobbies they care about.</li>
<li><strong>Room to differentiate.</strong> Look at existing sellers. Is there a gap in quality, design, sizing, education, sustainability or service you could fill?</li>
<li><strong>Healthy economics.</strong> Products that are very cheap, very heavy or very fragile make margins hard. Think about price point, shipping cost and breakage early.</li>
<li><strong>Personal fit.</strong> Knowledge or genuine interest helps you write better content, choose better products and stay motivated through slow months.</li>
</ol>
<h3>Warning signs</h3>
<ul>
<li>The niche depends entirely on a short-lived trend.</li>
<li>Products are regulated, need certification or carry safety risks you do not yet understand, for example cosmetics, supplements, children's products or electrical goods. These are not off limits, but you must research the rules before you sell.</li>
<li>Existing sellers compete only on price, which leaves little room for a newcomer.</li>
<li>You cannot explain why a customer would choose you over a large retailer.</li>
</ul>
<h2>Researching competitors</h2>
<p>Pick five to ten stores or marketplace listings already serving your niche. For each one, note the price range, product range, shipping and returns terms, and the tone of the brand. Read their customer reviews carefully, especially the critical ones. Repeated complaints about sizing, durability, slow delivery or poor support point to opportunities you could address.</p>
<h3>Steps to choose your niche</h3>
<ol>
<li>List three to five niche ideas based on your interests, skills or access to products.</li>
<li>Score each idea from 1 to 5 against the five criteria above.</li>
<li>Research competitors for your top two ideas.</li>
<li>Write a one-sentence positioning statement for the strongest idea: "For [customer] who [need], we offer [product] that [difference]."</li>
</ol>
<h3>Try this</h3>
<p>Complete the scoring exercise for at least three niche ideas in a spreadsheet, adding a notes column for your competitor findings. Keep the sheet: in the next lesson you will use it to plan how to test demand for your chosen product.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Validating product demand before you invest', 'Low-cost ways to test whether people want your product before you buy stock.', 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Many new stores struggle for a simple reason: the owner was sure people wanted the product, bought stock, built a website and only then discovered that demand was weaker than expected. Validation means gathering evidence before you commit significant money. No method gives certainty, but several cheap tests can reduce your risk considerably.</p>
<h2>Signals of demand you can check for free</h2>
<ul>
<li><strong>Search interest.</strong> Tools such as Google Trends and the keyword planners offered by advertising platforms show whether people search for related terms and whether interest is rising, falling or seasonal.</li>
<li><strong>Marketplace activity.</strong> On large marketplaces, look at how many sellers offer similar products, how many reviews they have accumulated and what buyers praise or complain about. A busy listing page with many reviews shows demand and competition at the same time.</li>
<li><strong>Community conversation.</strong> Forums, social media groups and video comments reveal the language customers use and the problems they want solved.</li>
</ul>
<h2>Tests that involve real customers</h2>
<p>Desk research tells you people are interested in a category. Direct tests tell you whether they will act on your specific offer.</p>
<h3>Customer conversations</h3>
<p>Talk to people who match your target customer. Ask about past behaviour rather than hypothetical future purchases: "When did you last buy something like this? What did you pay? What annoyed you?" People are polite about ideas, but their past spending is more honest evidence.</p>
<h3>Waitlists and pre-orders</h3>
<p>Create a simple page describing the product with a clear price and ask visitors to join a waitlist or place a pre-order. Pre-orders are the strongest signal because money changes hands. If you take pre-orders, be transparent about delivery dates and follow the consumer protection rules in the places you sell.</p>
<h3>Small test batches</h3>
<p>Order a small quantity, or sell through a marketplace or local market first. You learn about quality, packaging and customer questions with limited risk.</p>
<h2>Deciding what counts as success</h2>
<p>Set your success threshold before the test begins; otherwise it is tempting to read any result as positive. For example, you might decide a test passes if a certain share of waitlist sign-ups convert to pre-orders, or if your first batch sells out within a set number of weeks at your target price. The right numbers depend on your budget and goals. The important part is writing them down in advance.</p>
<h3>Validation checklist</h3>
<ol>
<li>Confirm that search or marketplace interest exists and note any seasonality.</li>
<li>Hold at least five conversations with potential customers.</li>
<li>Run one test that asks for a real commitment: an email sign-up, a pre-order or a purchase.</li>
<li>Compare the results with the threshold you set beforehand.</li>
<li>Decide whether to proceed, adjust the offer or try a different product.</li>
</ol>
<h3>Try this</h3>
<p>Pick your strongest product idea and write a one-page validation plan: which signals you will check, which real-customer test you will run, how much you will spend and what result would make you proceed.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Sourcing models: making, wholesale, dropshipping and print on demand', 'Compare the main ways to source products and the trade-offs each one brings.', 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once you know what you want to sell, you need a reliable way to get it. Your sourcing model affects your upfront cost, your margins, your control over quality and how fast you can ship. There is no universally best option, only the option that fits your product, budget and skills.</p>
<h2>The four common models</h2>
<h3>Making your own products</h3>
<p>Handmade or self-produced goods give you full control over design and quality, and they can command higher prices because they are distinctive. The trade-off is time: your production capacity limits how much you can sell, and scaling may require hiring help or outsourcing manufacturing.</p>
<h3>Wholesale and private label</h3>
<p>You buy finished goods in bulk from a manufacturer or distributor and resell them. With private label, the manufacturer produces items under your brand. Unit costs are usually lower than with other models, but you pay upfront, hold inventory and must meet the supplier's minimum order quantity (MOQ). Poor demand forecasting can leave you with unsold stock.</p>
<h3>Dropshipping</h3>
<p>A supplier holds the stock and ships directly to your customer when you pass on an order. You avoid buying inventory, which lowers startup cost. In exchange, margins tend to be thinner, delivery times and quality are in the supplier's hands, and many other stores may sell identical products. Customers will still hold you responsible when something goes wrong.</p>
<h3>Print on demand</h3>
<p>A print partner applies your designs to items such as clothing, mugs or posters only after an order is placed. It suits designers and creators testing ideas without inventory, but unit costs are higher than bulk printing and you depend on the partner's production quality and speed.</p>
<h2>How to evaluate a supplier</h2>
<ul>
<li><strong>Samples.</strong> Always order samples and inspect them as a customer would.</li>
<li><strong>Total cost.</strong> Ask about unit prices at different quantities, packaging, shipping to you or your customer, and payment terms.</li>
<li><strong>Lead times.</strong> Find out how long production and shipping take, and how this changes in busy seasons.</li>
<li><strong>Communication.</strong> Notice how quickly and clearly they respond before you are a customer; it rarely improves afterwards.</li>
<li><strong>Compliance.</strong> Confirm the products meet the safety, labelling and import rules of the countries you sell to, and ask for supporting documents.</li>
<li><strong>Backup.</strong> Identify at least one alternative supplier in case your main one has problems.</li>
</ul>
<h3>Steps to choose your sourcing model</h3>
<ol>
<li>List the models that are realistic for your product.</li>
<li>For each, estimate upfront cost, unit cost and delivery time to the customer.</li>
<li>Decide how much quality control and branding matter to your positioning.</li>
<li>Shortlist two or three suppliers and request samples and written quotes.</li>
<li>Record everything in your spreadsheet so you can compare like with like.</li>
</ol>
<h3>Try this</h3>
<p>Request quotes from at least two suppliers for your chosen product. Note their unit price, minimum order quantity, lead time and shipping costs. You will use these numbers to calculate your landed cost and margins in Module 2.</p>$h$));

  -- Module 2
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Pricing and margins', 'Work out what each sale really costs you and set prices that leave a healthy profit.', 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Landed cost: what one unit really costs you', 'Build an accurate per-unit cost that includes freight, duties and packaging.', 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Pricing starts with knowing your cost, and most beginners underestimate it. The supplier's unit price is only the first line. Landed cost is the total cost of getting one sellable unit into your hands, or your warehouse, ready to ship to a customer.</p>
<h2>What goes into landed cost</h2>
<ul>
<li><strong>Product cost:</strong> the unit price from your supplier, or your materials cost if you make the item.</li>
<li><strong>Inbound freight:</strong> shipping from the supplier to you, divided across the units in the shipment.</li>
<li><strong>Duties and import taxes:</strong> charges applied when goods cross a border. They depend on the product's classification and the countries involved.</li>
<li><strong>Customs brokerage and handling:</strong> fees for clearing goods through customs if you use a broker or courier service.</li>
<li><strong>Inspection, samples and labelling:</strong> one-off or per-shipment costs spread over the units.</li>
<li><strong>Product packaging:</strong> boxes, inserts, labels and tags that form part of the product.</li>
</ul>
<p>If you make products yourself, include materials and a realistic value for your production time. Leaving your time out makes the business look more profitable than it is and hides the point at which you need help.</p>
<h2>A worked example</h2>
<p>Imagine you order 200 units at 6.00 each, in whatever currency you use. Freight costs 180 for the shipment, duties come to 120 and customs handling is 40. Labels and inserts cost 0.30 per unit.</p>
<ol>
<li>Product cost: 6.00 per unit.</li>
<li>Freight: 180 divided by 200 units = 0.90 per unit.</li>
<li>Duties and handling: (120 + 40) divided by 200 units = 0.80 per unit.</li>
<li>Labels and inserts: 0.30 per unit.</li>
<li>Landed cost: 6.00 + 0.90 + 0.80 + 0.30 = 8.00 per unit.</li>
</ol>
<p>The landed cost is a third higher than the supplier's price. Pricing from 6.00 instead of 8.00 would quietly eat into every sale.</p>
<h2>Keep your cost current</h2>
<p>Freight rates, exchange rates and duty rates change. Recalculate landed cost for each new shipment, and use a weighted average when you hold stock bought at different prices. Duty rates and classification rules are set by customs authorities, so check the official customs guidance for your country or ask a customs broker rather than relying on a supplier's estimate.</p>
<h3>Landed cost checklist</h3>
<ul>
<li>Do I have a written quote that includes the unit price at my order quantity?</li>
<li>Have I included freight, duties, taxes and brokerage?</li>
<li>Have I added one-off costs, such as samples and inspections, spread over the order?</li>
<li>Have I included product packaging and labels?</li>
<li>Have I checked the exchange rate if I pay in a foreign currency?</li>
</ul>
<h3>Try this</h3>
<p>Build a landed cost calculator in your spreadsheet with one row per cost line and a total per unit. Enter the supplier quotes you collected in Module 1 and calculate the landed cost for two different order quantities. Notice how the per-unit cost changes as fixed shipment costs are spread over more units.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Gross margin, markup and contribution margin', 'Calculate the profit each order really leaves after every variable cost.', 'article', 1, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Two products can sell for the same price and leave very different profits. To compare them, and to know whether your store can afford its marketing, you need three related measures: markup, gross margin and contribution margin. They are easy to confuse, so this lesson defines each one precisely.</p>
<h2>Markup versus gross margin</h2>
<p>Both compare price with cost, but from different starting points.</p>
<ul>
<li><strong>Markup</strong> is profit as a percentage of cost: <code>(price - cost) / cost</code>.</li>
<li><strong>Gross margin</strong> is profit as a percentage of price: <code>(price - cost) / price</code>.</li>
</ul>
<p>Using the landed cost of 8.00 from the previous lesson and a selling price of 20.00, the gross profit is 12.00. Markup is 12 / 8 = 150%. Gross margin is 12 / 20 = 60%. Saying "I have a 150% margin" when you mean markup leads to poor decisions, because a margin can never exceed 100%.</p>
<h2>Contribution margin per order</h2>
<p>Gross margin ignores the costs that occur with every order. Contribution margin subtracts them, showing what each order contributes towards fixed costs and profit. Using example figures for a single-item order:</p>
<ol>
<li>Selling price: 20.00</li>
<li>Minus landed cost: 8.00</li>
<li>Minus packaging and the shipping you pay: 3.50</li>
<li>Minus payment processing fees: 0.90</li>
<li>Minus platform or marketplace fees: 0.60</li>
<li>Minus an allowance for returns and damage: 0.50</li>
<li>Contribution before marketing: 6.50</li>
</ol>
<p>If you spend an average of 4.00 on advertising to win each order, contribution after marketing falls to 2.50. That 2.50 must cover subscriptions, tools, storage, your time and any profit. The fee amounts above are illustrative only. Payment and platform fees vary by provider, country and plan, so check the current pricing pages for the services you use.</p>
<h2>Using these numbers to make decisions</h2>
<p>Contribution margin answers practical questions. How much can I afford to pay to win an order? Should I offer free shipping? Is this product worth stocking at all? A product with a high price but heavy shipping costs may contribute less than a cheaper, lighter item. In the example, contribution before marketing is 6.50, so spending more than 6.50 in marketing per order would mean losing money on every sale.</p>
<h3>Margin calculation steps</h3>
<ol>
<li>List every variable cost that occurs per order, not just per unit.</li>
<li>Calculate gross margin for each product.</li>
<li>Calculate contribution margin before and after marketing.</li>
<li>Flag any product whose contribution after marketing is close to zero or negative.</li>
<li>Revisit these numbers whenever a supplier price, carrier rate or fee changes.</li>
</ol>
<h3>Try this</h3>
<p>Add a contribution margin section to your spreadsheet. For your main product, calculate gross margin, contribution before marketing and the maximum you could spend to acquire an order while still breaking even.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Pricing strategies: cost, value and competition', 'Combine cost-based, value-based and competitor-based thinking to set a price you can defend.', 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your costs set the floor for your price, but they do not tell you what customers will pay. Good pricing combines three perspectives: what the product costs you, what it is worth to the customer and what alternatives the customer can buy. This lesson shows how to use all three to arrive at a price you can defend.</p>
<h2>Three pricing perspectives</h2>
<h3>Cost-based pricing</h3>
<p>You start from landed cost and add a target margin. To hit a target gross margin, divide cost by one minus the target margin: <code>price = cost / (1 - target margin)</code>. With a landed cost of 8.00 and a 60% target margin, the price is 8.00 / 0.40 = 20.00. Cost-based pricing protects you from selling at a loss, but used alone it can leave money on the table or price you out of the market.</p>
<h3>Value-based pricing</h3>
<p>You start from the benefit the customer receives. A product that saves time, solves a painful problem, expresses identity or is hard to find elsewhere can carry a higher price. Customer conversations, reviews of similar products and your positioning statement all help you judge perceived value.</p>
<h3>Competitor-based pricing</h3>
<p>You look at what similar products sell for. This shows the range customers expect, but copying a competitor's price assumes their costs and strategy match yours, which is rarely true. Use competitor prices as a reference, not an instruction.</p>
<h2>Practical pricing techniques</h2>
<ul>
<li><strong>Tiers.</strong> Offering good, better and best versions lets customers choose their level and can lift the average order value.</li>
<li><strong>Bundles.</strong> Grouping related items can raise order value and reduce shipping cost per item.</li>
<li><strong>Price endings.</strong> Prices ending in 9 or 5 are common in discount-led markets, while round numbers can suit premium positioning. Choose the style that matches your brand and use it consistently.</li>
<li><strong>Testing.</strong> Try a price change on a new product or for a fixed period, then compare conversion rate and contribution margin, not just revenue.</li>
</ul>
<h2>Avoiding common mistakes</h2>
<p>Do not compete purely on lowest price unless you have a genuine cost advantage. Build in room for the discounts and promotions you may run later. When you show a reference price, such as an original price next to a sale price, make sure it is genuine: many jurisdictions have rules against misleading price comparisons.</p>
<h3>Pricing steps</h3>
<ol>
<li>Calculate your floor price from landed cost and your minimum acceptable margin.</li>
<li>Record the price range of five or more comparable products.</li>
<li>Estimate the value your product offers relative to those alternatives.</li>
<li>Choose a price, then check its contribution margin after expected marketing cost.</li>
<li>Decide when you will review the price and what data you will use.</li>
</ol>
<h3>Try this</h3>
<p>For your main product, write down your floor price, the competitor price range and your chosen price with a two-sentence justification. Check that the chosen price still leaves a positive contribution after marketing.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Discounts, bundles and free shipping without losing money', 'Model promotions before you run them so they grow sales without erasing profit.', 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Discounts and free shipping are powerful tools, and they are also the fastest way to sell a lot while earning very little. The answer is not to avoid promotions but to model them first, so you know exactly what each one costs and what it needs to achieve.</p>
<h2>How a discount changes your margin</h2>
<p>A discount comes straight off your contribution, because your costs stay the same. Using the earlier example of a 20.00 product that contributes 6.50 before marketing, a 20% discount removes 4.00 from the price. Contribution falls to 2.50, a drop of more than 60% in what the order earns you. To make the same total contribution, you would need to sell roughly two and a half times as many units.</p>
<p>That does not make the discount wrong. It might bring in new customers who later buy again at full price, or clear stock that would otherwise sit unsold. It does mean you should understand the trade-off and set a clear goal for each promotion.</p>
<h2>Free shipping and thresholds</h2>
<p>Customers respond strongly to free shipping, but someone always pays for it. Common approaches include:</p>
<ul>
<li><strong>Building shipping into the price</strong> of each product, so delivery appears free.</li>
<li><strong>A free shipping threshold</strong>, where orders above a set value ship free. Setting the threshold somewhat above your current average order value can encourage customers to add another item.</li>
<li><strong>Flat-rate shipping</strong>, which is simple to understand and lets you subsidise part of the cost.</li>
</ul>
<p>Whatever you choose, calculate contribution margin for an order just above the threshold, where shipping costs you the most relative to the order value.</p>
<h2>Bundles and gifts with purchase</h2>
<p>Bundles combine items at a price below their separate total. Because you ship one parcel instead of several, a bundle can offer a real saving to the customer while costing you less than an equivalent percentage discount. A low-cost gift with purchase can also feel generous without cutting the headline price.</p>
<h3>Promotion planning checklist</h3>
<ol>
<li>Define the goal: new customers, larger orders, clearing stock or rewarding loyalty.</li>
<li>Calculate contribution per order with the promotion applied.</li>
<li>Estimate how many extra orders you need to justify it.</li>
<li>Set an end date and limits, such as one use per customer.</li>
<li>Check that the promotion complies with local rules on pricing and reference prices.</li>
<li>Review the results afterwards against the goal, not just total revenue.</li>
</ol>
<h3>Try this</h3>
<p>Model one promotion you might run in your first three months. Calculate contribution per order with and without it, and write down how many orders you would need for it to be worthwhile. If the number looks unrealistic, adjust the offer and model it again.</p>$h$));

  -- Module 3
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Store platforms and setup choices', 'Compare where to sell, how platforms differ and the payment, legal and admin basics every store needs.', 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Marketplaces versus your own online store', 'Weigh the built-in reach of marketplaces against the control of an independent store.', 'article', 0, 11, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>You can sell online in two broad ways: on a marketplace that already has shoppers, or on your own store, where you must bring shoppers yourself. Many businesses use both. Understanding the trade-offs helps you decide where to start and how to grow.</p>
<h2>Selling on marketplaces</h2>
<p>Marketplaces such as Amazon, eBay, Etsy and similar regional platforms host listings from many sellers in one place. Their main advantage is built-in demand: shoppers already search there, and the platform handles much of the trust and checkout experience.</p>
<ul>
<li><strong>Strengths:</strong> immediate access to buyers, a familiar checkout, and optional fulfilment programmes on some platforms.</li>
<li><strong>Limitations:</strong> fees on each sale, strict rules you must follow, direct comparison with competitors on the same page and limited access to customer data for future marketing.</li>
<li><strong>Risk:</strong> your account can be restricted if you breach a policy, which can stop sales suddenly.</li>
</ul>
<h2>Running your own store</h2>
<p>An independent store built on a platform such as Shopify, WooCommerce, BigCommerce, Squarespace or Wix gives you your own domain, design and customer relationship.</p>
<ul>
<li><strong>Strengths:</strong> control over branding and the shopping experience, ownership of your customer list, and freedom to set your own policies within the law.</li>
<li><strong>Limitations:</strong> you must generate your own traffic, and building trust as an unknown brand takes time.</li>
<li><strong>Costs:</strong> platform subscription, payment processing, themes, apps and marketing.</li>
</ul>
<h2>Choosing a starting point</h2>
<p>A marketplace-first approach suits sellers who want to test demand quickly, or whose customers habitually shop on a particular marketplace. A store-first approach suits brands with a distinctive identity, an existing audience, or products that benefit from storytelling and education. A common path is to validate on a marketplace and then build an independent store to grow repeat business, while keeping the marketplace as one channel among several.</p>
<p>Whichever you choose, read the seller policies and fee pages of each platform before committing. Fees, rules and programmes change, so rely on the official pages rather than older articles or forum posts.</p>
<h3>Decision checklist</h3>
<ul>
<li>Where do my target customers already shop for this type of product?</li>
<li>Do I have an audience, such as social followers or an email list, that I can bring to my own store?</li>
<li>How important are brand building and owning customer data to my plan?</li>
<li>What would happen to my business if one channel suspended my account?</li>
<li>What are the full fees for each channel at my expected price and volume?</li>
</ul>
<h3>Try this</h3>
<p>Choose two possible channels, such as one marketplace and one store platform. Using their official fee pages, estimate the total platform and payment fees on a single order of your main product for each, and add the results to your contribution margin sheet.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Comparing hosted and self-hosted store platforms', 'Understand how store platforms differ and choose one that fits your skills, budget and plans.', 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>If you build your own store, your platform choice shapes your daily workload, your costs and how easily you can grow. Platforms fall into two families, and the right one depends less on long feature lists and more on your skills, budget and plans.</p>
<h2>Hosted platforms</h2>
<p>Hosted platforms, also called software as a service (SaaS), such as Shopify, BigCommerce, Squarespace and Wix, run the software and servers for you. You pay a subscription and manage your store through a web dashboard.</p>
<ul>
<li>Hosting, software updates and much of the checkout security are handled by the provider.</li>
<li>Setup is fast and does not require coding.</li>
<li>Extra features come from apps or integrations, which may add monthly costs.</li>
<li>You work within the platform's rules and structure, which can limit unusual customisations.</li>
</ul>
<h2>Self-hosted platforms</h2>
<p>Self-hosted options, such as WooCommerce (an e-commerce plugin for WordPress) or other open-source software, run on hosting that you arrange.</p>
<ul>
<li>You get extensive control over code, data and design.</li>
<li>The core software may be free, but you pay for hosting, extensions, themes and often developer time.</li>
<li>You are responsible for updates, backups, performance and security, including how payment details are handled.</li>
<li>It suits people comfortable with technical maintenance or with reliable access to a developer.</li>
</ul>
<h2>Criteria that matter for beginners</h2>
<ol>
<li><strong>Total cost of ownership.</strong> Add subscription, transaction or payment fees, themes, apps or plugins, hosting and any paid help. Check each provider's current pricing page.</li>
<li><strong>Ease of use.</strong> Use the free trial or demo. Add a product, edit a page and run a test checkout yourself.</li>
<li><strong>Payments.</strong> Confirm which payment providers and methods are available in your country and in your customers' countries.</li>
<li><strong>Features you need.</strong> For example product variants, subscriptions, digital products, multiple currencies, wholesale pricing or local pickup.</li>
<li><strong>Integrations.</strong> Check compatibility with the shipping, accounting, email and marketplace tools you plan to use.</li>
<li><strong>Portability.</strong> Find out how you can export products, customers and orders if you ever need to move.</li>
</ol>
<h3>Platform trial steps</h3>
<ol>
<li>Shortlist two or three platforms that support your country and payment needs.</li>
<li>Start a trial on each and add the same three products.</li>
<li>Customise the home page and a product page using a free theme.</li>
<li>Run a test order through to the confirmation email.</li>
<li>Score each platform on cost, ease of use, required features and integrations.</li>
</ol>
<h3>Try this</h3>
<p>Complete the trial steps for at least two platforms and write a short recommendation for yourself: which platform you would choose today, why, and what would make you reconsider in a year's time.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Payments, checkout and building trust', 'Choose payment options and checkout details that make buyers comfortable completing an order.', 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A visitor who reaches your checkout has already decided they want the product. Whether they complete the purchase depends largely on trust and convenience. This lesson covers the payment and checkout choices that influence that final step.</p>
<h2>How online payments work</h2>
<p>When a customer pays by card, a payment provider (sometimes called a payment gateway or processor) securely collects the card details, requests authorisation through the card network from the customer's bank and later transfers the funds to your bank account, minus its fees. Fees are usually a percentage of the transaction plus a fixed amount, and they vary by provider, country, card type and plan. Funds are paid out on a schedule, so plan your cash flow around the payout timing your provider states.</p>
<p>Handling card data carries security obligations under the Payment Card Industry Data Security Standard (PCI DSS). Hosted checkouts and established payment providers take on much of this burden, which is one reason beginners should avoid building custom payment handling.</p>
<h2>Payment methods to consider</h2>
<ul>
<li>Major credit and debit cards.</li>
<li>Digital wallets, which let customers pay on mobile without typing card details.</li>
<li>Locally popular methods, such as bank transfer schemes or regional wallets, depending on where your customers live.</li>
<li>Buy now, pay later services, which some customers expect for higher-priced items. Check the provider's terms, fees and how refunds work.</li>
</ul>
<h2>Trust signals that support checkout</h2>
<ul>
<li>A secure (HTTPS) store on your own domain.</li>
<li>A clear total cost, including shipping and taxes, shown before the final step.</li>
<li>Visible shipping, returns and privacy policies.</li>
<li>Real contact details and a responsive support channel.</li>
<li>Accurate product photos and descriptions, so customers know exactly what they are buying.</li>
<li>Genuine customer reviews once you have them. Never invent or buy reviews: it misleads customers and breaks the rules of most platforms and many consumer protection laws.</li>
</ul>
<h3>Checkout setup checklist</h3>
<ol>
<li>Choose a payment provider available in your country and confirm its fees on its official pricing page.</li>
<li>Enable the payment methods your customers use most.</li>
<li>Show shipping costs early, on product pages or in the cart.</li>
<li>Keep checkout fields to the minimum you genuinely need.</li>
<li>Allow guest checkout unless you have a strong reason to require accounts.</li>
<li>Place a test order on mobile and desktop, then refund it.</li>
</ol>
<h3>Try this</h3>
<p>Go through the checkout of two stores you admire using your phone, stopping before you pay. Note every moment where you felt reassured or hesitant, then list three changes you will make to your own checkout as a result.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Legal, tax and admin basics for online sellers', 'The policies, registrations and records an online store needs, and when to get professional advice.', 'article', 3, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Running an online store means running a business, with responsibilities that apply whether you sell one item or a thousand. Rules differ between countries and regions, so this lesson explains what to look for rather than giving legal advice. For your specific situation, consult official government guidance and a qualified accountant or lawyer.</p>
<h2>Registration, records and tax</h2>
<p>Most places require you to register a business or declare self-employment income once you trade regularly. Decide on a business structure, open a separate bank account for the store and keep records of every sale, refund, expense and stock purchase. Good records make tax filing easier and give you the numbers you need to manage the business.</p>
<h3>Sales taxes and VAT</h3>
<p>Many countries and states charge a consumption tax, such as sales tax, VAT or GST, on goods sold to consumers. Whether you must register and collect it depends on factors such as where you are based, where your customers are, what you sell and how much you sell. Rules for cross-border sales can differ from domestic ones. Store platforms often include tools to calculate tax at checkout, but you remain responsible for registering, charging the correct rate and filing returns. Check your tax authority's official guidance before your first sale.</p>
<h2>Store policies customers expect</h2>
<ul>
<li><strong>Privacy policy:</strong> what personal data you collect, why, how long you keep it and who you share it with. Data protection laws, such as the GDPR in the European Union and its UK equivalent, may apply depending on where your customers are.</li>
<li><strong>Terms of service:</strong> the conditions of sale, including payment, pricing errors and liability.</li>
<li><strong>Shipping policy:</strong> where you ship, how long delivery takes and what it costs.</li>
<li><strong>Returns and refund policy:</strong> how customers return items and how refunds work. Consumer laws in many regions give buyers statutory rights, such as a cancellation period for online purchases, that your policy cannot remove.</li>
</ul>
<p>Templates from your platform are a useful starting point, but read them carefully and adapt them to how your business actually operates.</p>
<h2>Product and marketing rules</h2>
<p>Some products need specific labelling, safety testing or certification. Marketing is regulated too: claims must be truthful, paid partnerships may need to be disclosed and email marketing usually requires consent. Research the rules that apply to your category before launch.</p>
<h3>Admin checklist before your first sale</h3>
<ul>
<li>Register the business as required where you live.</li>
<li>Open a separate business bank account.</li>
<li>Check sales tax or VAT registration requirements for the places you sell to.</li>
<li>Publish privacy, terms, shipping and returns policies.</li>
<li>Confirm product labelling and safety requirements.</li>
<li>Set up a simple bookkeeping system for income and expenses.</li>
</ul>
<h3>Try this</h3>
<p>Find your tax authority's official guidance on selling goods online and summarise, in five bullet points, what applies to you. List any open questions to take to an accountant before you launch.</p>$h$));

  -- Module 4
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Fulfilment, shipping and returns', 'Get orders to customers reliably and handle returns in a way that protects both customers and margins.', 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing a fulfilment model', 'Compare fulfilling orders yourself, using a third-party logistics partner and supplier fulfilment.', 'article', 0, 11, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Fulfilment is everything that happens between a customer clicking "buy" and the parcel arriving: storing stock, picking items, packing them, labelling the parcel and handing it to a carrier. Customers judge your store heavily on this experience, so choose a model you can run reliably.</p>
<h2>Three fulfilment models</h2>
<h3>Self-fulfilment</h3>
<p>You store stock and pack orders yourself, from home or a small unit. It is the cheapest way to start and gives you complete control over packaging and quality checks. It also consumes time and space, and your personal capacity limits how many orders you can ship during busy periods or when you are away.</p>
<h3>Third-party logistics (3PL)</h3>
<p>A 3PL provider stores your inventory in its warehouse and picks, packs and ships orders when they arrive from your store. Fees are typically charged for receiving stock, storage, each order picked and packed, and packaging materials, plus shipping. A 3PL can offer faster, more consistent fulfilment and negotiated carrier rates, but you give up some control and must manage the relationship and the software integration.</p>
<h3>Supplier fulfilment and dropshipping</h3>
<p>Your supplier ships directly to the customer. You avoid holding stock, but you depend entirely on the supplier's speed, packaging and accuracy. Agree service standards in writing and test their performance by ordering from your own store.</p>
<h2>When to change model</h2>
<p>Many stores start with self-fulfilment and move to a 3PL when packing takes too much of the owner's time, storage runs out or customers in other regions need faster delivery. Compare the full cost per order, not just storage fees, and remember to put a value on your own time. Ask any 3PL for a detailed quote based on your actual product sizes and expected monthly order volume, and check which store platforms they integrate with.</p>
<h3>Fulfilment process steps for self-fulfilment</h3>
<ol>
<li>Check new orders at set times each day.</li>
<li>Pick items using a packing list and check them against the order.</li>
<li>Inspect each item for damage or defects.</li>
<li>Pack using suitable protection and include any inserts or returns information.</li>
<li>Create the shipping label and mark the order as fulfilled with its tracking number.</li>
<li>Hand parcels to the carrier and confirm the tracking email has reached the customer.</li>
</ol>
<h3>Try this</h3>
<p>Time yourself packing three sample orders from start to finish, including printing the label. Multiply the average time by your expected weekly orders to see how many hours fulfilment would take, and decide whether self-fulfilment is realistic for your first six months.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Inventory management basics', 'Track stock, set reorder points and avoid both stockouts and dead stock.', 'article', 1, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Inventory is cash sitting on shelves. Too little and you lose sales and disappoint customers; too much and your money is tied up in products that may never sell. Good inventory management finds a sensible middle ground using simple data and regular routines.</p>
<h2>Track every unit</h2>
<p>Give each product variant a unique stock keeping unit (SKU), such as a code combining product, colour and size. Record stock levels in your store platform or an inventory tool, and update them whenever stock arrives, sells, is returned or is damaged. Count physical stock regularly and compare the count with your system; differences reveal errors, damage or loss early.</p>
<h2>Knowing when to reorder</h2>
<p>A reorder point tells you when to place a new purchase order so that stock arrives before you run out. A simple formula is:</p>
<p><code>reorder point = (average daily sales x lead time in days) + safety stock</code></p>
<p>For example, if you sell an average of 4 units a day and your supplier takes 20 days from order to delivery, you will sell about 80 units during the lead time. If you keep 30 units as safety stock to cover delays or a spike in demand, your reorder point is 110 units. When stock falls to 110, you reorder.</p>
<p>Lead time includes production, shipping and customs clearance, so use realistic figures from past orders and allow extra time before busy seasons, when suppliers and carriers are under pressure.</p>
<h2>Avoiding dead stock</h2>
<p>Dead stock is inventory that is not selling. It costs storage, can age or go out of fashion and ties up cash. Review sales by SKU each month and look for items with little movement. Options include bundling them with best-sellers, running a targeted promotion, offering them as gifts with purchase or selling them through a clearance channel. Learn from the pattern too: perhaps a particular size or colour was over-ordered.</p>
<h3>Inventory routine checklist</h3>
<ul>
<li>Every SKU has a unique code and an accurate stock level in your system.</li>
<li>You know the lead time and reorder point for each core product.</li>
<li>You review stock levels weekly and sales by SKU monthly.</li>
<li>You run a full physical stock count at least every quarter.</li>
<li>You plan purchases for seasonal peaks well in advance.</li>
<li>Your store marks items as sold out automatically, or you have deliberately chosen to accept backorders with clear delivery dates.</li>
</ul>
<h3>Try this</h3>
<p>For your main product, estimate average daily sales (use your validation results or a cautious guess), lead time and safety stock. Calculate the reorder point and the size of your first purchase order, then use your landed cost to work out how much cash that order would require.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Shipping strategy: carriers, rates and packaging', 'Choose carriers, set shipping rates and package orders so they arrive safely and affordably.', 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Shipping is one of the largest variable costs for most online stores and one of the biggest influences on customer satisfaction. A clear shipping strategy balances speed, cost and reliability for the customers you serve.</p>
<h2>Understanding what you pay</h2>
<p>Carriers price parcels using weight, size, destination and service speed. Many carriers use dimensional (volumetric) weight, which means a light but bulky parcel can be charged as though it were heavier. Packing in the smallest suitable box can therefore lower costs noticeably. Rates, surcharges and size limits change, so compare current rates on carrier websites or through your store platform's shipping tools, which may offer discounted labels.</p>
<h2>Choosing what to charge customers</h2>
<p>Common options for your store's shipping rates include:</p>
<ul>
<li><strong>Flat rate:</strong> one price per order or per region. Simple to understand, and you absorb the variation in real costs.</li>
<li><strong>Calculated rates:</strong> the live carrier price for the customer's address and parcel. Accurate, but it depends on correct product weights and can produce surprising totals.</li>
<li><strong>Free shipping:</strong> built into prices or offered above a threshold, as covered in Module 2.</li>
<li><strong>Local delivery or pickup:</strong> useful if you have customers nearby.</li>
</ul>
<p>Offer a small number of clear choices, such as standard and express, rather than a long list that slows the customer down.</p>
<h2>Packaging and delivery communication</h2>
<p>Damaged parcels cost you a replacement, a second shipment and customer goodwill. Choose packaging suited to the product: padded mailers for soft goods, boxes with void fill for fragile items and sealed bags for anything that might leak. Consider how the parcel looks on arrival, but prioritise protection and size efficiency over decoration.</p>
<p>Many "where is my order?" messages come from uncertainty. Show estimated delivery times on product and checkout pages, send tracking promptly and warn customers early about delays during peak seasons or disruptions.</p>
<h3>Shipping setup checklist</h3>
<ol>
<li>Weigh and measure each product in its packaging and record it in your store.</li>
<li>Compare at least two carriers for your most common parcel size and destination.</li>
<li>Decide your rate structure and calculate contribution margin for typical orders.</li>
<li>Define where you ship to; international shipping adds customs forms, duties and longer delivery times.</li>
<li>State realistic processing and delivery times in your shipping policy.</li>
<li>Provide tracking on every order and send it to the customer automatically.</li>
</ol>
<h3>Try this</h3>
<p>Pack your main product as you would for a customer, then weigh and measure the parcel. Get current rates from two carriers for your three most likely destinations and choose your rate structure based on the contribution margin each option leaves.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Designing a returns and refunds process', 'Write a fair returns policy, handle returns efficiently and reduce avoidable returns.', 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Returns are part of selling online. Customers cannot touch or try products before buying, so some will send items back. A clear, fair returns process gives shoppers the confidence to buy in the first place, while a well-run process keeps the cost under control.</p>
<h2>Writing your returns policy</h2>
<p>Your policy should answer the questions customers ask before buying:</p>
<ul>
<li>How long do I have to return an item, and does the period start from the order date or the delivery date?</li>
<li>What condition must items be in, and are any items excluded, such as personalised or hygiene-sensitive products?</li>
<li>Who pays for return shipping?</li>
<li>Will I receive a refund, an exchange or store credit, and how long will it take?</li>
<li>How do I start a return?</li>
</ul>
<p>Make sure your policy respects the statutory consumer rights where your customers live. Some regions give buyers a legal right to cancel online purchases within a set period, and rights for faulty goods usually apply regardless of your own policy. Check the official consumer guidance for each market you sell to.</p>
<h2>Running returns efficiently</h2>
<ol>
<li><strong>Request.</strong> The customer starts a return through a form, email or your platform's returns feature and gives a reason.</li>
<li><strong>Approve and instruct.</strong> You confirm eligibility and send the return address or a label.</li>
<li><strong>Receive and inspect.</strong> You check the item's condition on arrival and decide whether it can be resold.</li>
<li><strong>Resolve.</strong> You issue the refund, exchange or credit promptly and tell the customer.</li>
<li><strong>Restock or write off.</strong> You update inventory so resellable items are available again.</li>
</ol>
<h2>Reducing avoidable returns and disputes</h2>
<p>Record the reason for every return and review the patterns monthly. Frequent "not as described" returns point to unclear photos or descriptions. Sizing returns suggest you need better size guides or fit notes. Damage in transit calls for better packaging. Each fix improves both your margin and the customer experience.</p>
<p>A chargeback happens when a customer asks their card issuer to reverse a payment. Keep order records, tracking and delivery confirmation, and customer messages so you can respond with evidence. Responding quickly and fairly to complaints often prevents a dispute from starting at all.</p>
<h3>Returns checklist</h3>
<ul>
<li>Policy published and linked from product pages, the site footer and order emails.</li>
<li>A simple way for customers to start a return.</li>
<li>A return reason recorded for every case.</li>
<li>Refunds issued within the time your policy promises.</li>
<li>A monthly review of return reasons and costs.</li>
</ul>
<h3>Try this</h3>
<p>Draft your returns policy in plain language, answering the five customer questions above. Then estimate the full cost of one return for your main product, including both shipping legs and the chance that the item cannot be resold.</p>$h$));

  -- Module 5
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Customer service and store metrics', 'Turn first orders into loyal customers and use a small set of metrics to run the business.', 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Customer service that earns repeat business', 'Set up channels, response standards and saved replies so every customer feels looked after.', 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>For a small store, customer service is a genuine competitive advantage. Large retailers often struggle to respond personally; you can. Customers who receive quick, helpful answers are more likely to buy again and recommend you, and a problem handled well can build more loyalty than an order that never had an issue.</p>
<h2>Choose channels you can actually staff</h2>
<p>Offer support only through channels you can monitor reliably. Email or a contact form is the minimum. Live chat and social media messages can help shoppers decide, but they also raise expectations of very fast replies. Two channels done well are better than five done poorly. State your support hours and typical response time on your contact page so customers know what to expect.</p>
<h2>Standards, tools and problem handling</h2>
<h3>Response standards</h3>
<p>Set yourself a target, such as replying to every message within one business day, and track whether you meet it. Prioritise messages about orders that have not arrived, damaged items and payment problems, because these customers are most at risk of leaving or opening a dispute.</p>
<h3>Saved replies and a help centre</h3>
<p>Most questions repeat: delivery times, order tracking, returns, sizing and product care. Write clear answers once and save them as templates that you personalise before sending. Publish the same information as an FAQ or help page so customers can find answers without contacting you. Review your inbox monthly to spot new common questions and update both.</p>
<h3>Handling problems well</h3>
<ol>
<li>Acknowledge the issue and thank the customer for raising it.</li>
<li>Apologise for the experience without blaming the customer, the carrier or the supplier.</li>
<li>Gather the facts you need, such as the order number and photos of any damage.</li>
<li>Offer a clear solution and a timeframe.</li>
<li>Follow through, and confirm with the customer once it is resolved.</li>
<li>Record the cause so you can prevent it from happening again.</li>
</ol>
<h2>Turning service into retention</h2>
<p>Service continues after delivery. A short follow-up email asking whether the order arrived safely, with care tips or usage advice, invites feedback and honest reviews. With the customer's marketing consent, a welcome series and occasional useful emails keep your store in mind for the next purchase. Honour unsubscribe requests promptly and follow the consent rules that apply where your customers live.</p>
<h3>Customer service checklist</h3>
<ul>
<li>Support channels and hours are listed on the contact page.</li>
<li>A response time target is set and tracked.</li>
<li>Saved replies exist for the ten most common questions.</li>
<li>An FAQ page covers shipping, returns, sizing and payments.</li>
<li>Every complaint is logged with its cause and resolution.</li>
</ul>
<h3>Try this</h3>
<p>Write saved replies for the five questions you expect most often. Then write a post-delivery follow-up email that checks the order arrived safely and invites honest feedback.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'The metrics that run an online store', 'Track conversion rate, average order value, acquisition cost, repeat rate and margin, and act on what they show.', 'article', 1, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Store dashboards can show dozens of numbers. A small set explains most of what is happening in your business and points to what to fix next. This lesson defines the core metrics, how to calculate them and what each one tells you.</p>
<h2>The core metrics</h2>
<ul>
<li><strong>Sessions:</strong> visits to your store over a period. Look at where they come from, such as search, social media, email or ads.</li>
<li><strong>Conversion rate:</strong> <code>orders / sessions</code>, the share of visits that end in an order.</li>
<li><strong>Average order value (AOV):</strong> <code>revenue / orders</code>.</li>
<li><strong>Customer acquisition cost (CAC):</strong> <code>marketing spend / new customers</code> for the same period.</li>
<li><strong>Repeat purchase rate:</strong> <code>customers with two or more orders / total customers</code> over a defined period.</li>
<li><strong>Gross margin and contribution margin:</strong> calculated as in Module 2 and tracked over time.</li>
<li><strong>Refund rate:</strong> <code>refunded orders / total orders</code>, ideally broken down by reason.</li>
</ul>
<h2>How the numbers fit together</h2>
<p>Revenue equals sessions multiplied by conversion rate multiplied by average order value. That gives you three levers: attract more relevant visitors, convert more of them or increase what each order is worth. When revenue changes, check which lever moved before deciding what to do.</p>
<p>Profitability depends on comparing what you pay to win a customer with what that customer earns you. A simple estimate of customer lifetime value (LTV) based on contribution is the average contribution per order multiplied by the average number of orders per customer over a period you choose. If CAC is higher than this contribution-based value, growth through paid marketing loses money. Use realistic, conservative figures, especially while your store is young and you have little repeat data.</p>
<h2>Building a reporting habit</h2>
<p>Numbers only help if you review them regularly and compare like with like. Weekly reviews catch problems quickly; monthly reviews reveal trends. Compare against the same period in the previous month or year to account for seasonality, and note events such as promotions or stockouts that explain changes. Use your store platform's analytics and keep a simple spreadsheet of key figures so you can see the history at a glance.</p>
<h3>Weekly metrics routine</h3>
<ol>
<li>Record sessions, orders, revenue and marketing spend for the week.</li>
<li>Calculate conversion rate, AOV and CAC.</li>
<li>Note the top traffic sources and best-selling products.</li>
<li>Check refunds and customer service issues for patterns.</li>
<li>Choose one improvement to test next week and write down the change you expect to see.</li>
</ol>
<h3>Try this</h3>
<p>Create a weekly metrics sheet with a column for each metric in this lesson. Fill in your current figures or, if you have not launched yet, your planning estimates, and note which of the three revenue levers you will focus on first.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which statement best describes a niche for a new online store?$t$, $t$A niche is defined by a specific group of customers and their shared needs, not just a product category or a trend. Focus lets a new store compete on fit rather than on scale.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$A specific group of customers with shared needs that you can serve well$t$, true, 0),
    (qq, $t$Any product category with high search volume$t$, false, 1),
    (qq, $t$The cheapest products you can source$t$, false, 2),
    (qq, $t$Whatever product is currently trending on social media$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which validation test gives the strongest evidence that customers will buy your product?$t$, $t$Pre-orders involve money changing hands, so they are a far stronger signal than opinions, social engagement or general interest in a category.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Customers placing paid pre-orders$t$, true, 0),
    (qq, $t$Friends saying they like the idea$t$, false, 1),
    (qq, $t$A high number of likes on a social media post$t$, false, 2),
    (qq, $t$Rising search interest for the product category$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of the following belong in a product's landed cost? Select all that apply.$t$, $t$Landed cost covers everything needed to get one sellable unit to you: the unit price, inbound freight, duties, handling and product packaging. A platform subscription is a fixed cost, and advertising is a per-order marketing cost.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The supplier's unit price$t$, true, 0),
    (qq, $t$Inbound freight from the supplier$t$, true, 1),
    (qq, $t$Import duties on the shipment$t$, true, 2),
    (qq, $t$Your monthly store platform subscription$t$, false, 3),
    (qq, $t$Advertising spend to win each sale$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$A product has a landed cost of 10 and sells for 25. What is its gross margin?$t$, $t$Gross margin is (price - cost) / price, so 15 / 25 = 60%. 150% is the markup, which divides the profit by cost instead of price.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$60%$t$, true, 0),
    (qq, $t$150%$t$, false, 1),
    (qq, $t$40%$t$, false, 2),
    (qq, $t$15%$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$A 20% discount on a product reduces the contribution margin of that order by exactly 20%.$t$, $t$False. The discount comes off the price while your costs stay the same, so contribution usually falls by a much larger percentage than the discount itself.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, false, 0),
    (qq, $t$False$t$, true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Compared with a hosted platform, what extra responsibility do you usually take on with a self-hosted store platform?$t$, $t$With self-hosted software you arrange hosting and are responsible for updates, backups, performance and security. Hosted platforms handle most of this for you.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Hosting, software updates and security$t$, true, 0),
    (qq, $t$Writing product descriptions$t$, false, 1),
    (qq, $t$Choosing which products to sell$t$, false, 2),
    (qq, $t$Answering customer emails$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$You sell an average of 5 units a day, your supplier lead time is 14 days and you keep 20 units of safety stock. What is your reorder point?$t$, $t$Reorder point = (average daily sales x lead time) + safety stock = (5 x 14) + 20 = 90 units.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$90 units$t$, true, 0),
    (qq, $t$70 units$t$, false, 1),
    (qq, $t$39 units$t$, false, 2),
    (qq, $t$120 units$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Your own returns policy can remove the statutory consumer rights that apply where your customers live.$t$, $t$False. Statutory rights, such as cancellation periods for online purchases or rights for faulty goods in many regions, apply regardless of what your own policy says.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, false, 0),
    (qq, $t$False$t$, true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$A customer tells you their parcel arrived damaged. What should you do first?$t$, $t$Start by acknowledging the problem and apologising without blaming anyone, then gather the facts you need, such as the order number and photos, so you can offer a clear solution.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Acknowledge the issue, apologise and ask for the order number and photos of the damage$t$, true, 0),
    (qq, $t$Tell the customer to contact the carrier themselves$t$, false, 1),
    (qq, $t$Explain that damage in transit is not your responsibility$t$, false, 2),
    (qq, $t$Wait to see whether the customer follows up$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which three figures multiply together to give your store's revenue? Select all that apply.$t$, $t$Revenue = sessions x conversion rate x average order value. Customer acquisition cost and refund rate matter for profitability, but they are not part of this revenue equation.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Sessions$t$, true, 0),
    (qq, $t$Conversion rate$t$, true, 1),
    (qq, $t$Average order value$t$, true, 2),
    (qq, $t$Customer acquisition cost$t$, false, 3),
    (qq, $t$Refund rate$t$, false, 4);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$This quiz checks your understanding of the whole course, from choosing a niche and pricing for margin to fulfilment, customer service and store metrics. Answer all ten questions. You need 70% to pass, and you will see the correct answers with explanations after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'Build a one-page store operating plan', $h$<p>In this assignment you bring the whole course together by writing a practical operating plan for an online store. Use a store you already run, a store you are planning or, if you have neither, a realistic product idea you could pursue. The goal is a plan you could genuinely act on, not a polished document for investors.</p>
<h2>What to produce</h2>
<p>Create a document or spreadsheet with the following five parts. Keep each part concise; bullet points and tables are welcome.</p>
<ol>
<li><strong>Niche and validation.</strong> Your positioning statement ("For [customer] who [need], we offer [product] that [difference]"), a short summary of your competitor research and either the results of a validation test or a plan for one, including the success threshold you set in advance.</li>
<li><strong>Unit economics and pricing.</strong> A landed cost breakdown for your main product, your chosen price with a short justification, gross margin, contribution margin before and after expected marketing cost, and the maximum you could spend to acquire an order while breaking even. Show your calculations.</li>
<li><strong>Platform and channels.</strong> The channel or channels you will sell through, the platform you chose and why, and the fees you checked on the official pricing pages.</li>
<li><strong>Fulfilment, shipping and returns.</strong> Your fulfilment model, the reorder point calculation for your main product, your shipping rate structure and a short summary of your draft returns policy.</li>
<li><strong>Service and metrics.</strong> Your support channels and response target, three saved replies and a weekly metrics sheet listing the metrics you will track, with a first target for each.</li>
</ol>
<h2>How to submit</h2>
<ul>
<li>Upload your document or spreadsheet as a file, share a link with view access, or paste the plan as text.</li>
<li>Label any figures that are estimates rather than real data. Estimates are fine; hidden assumptions are not.</li>
<li>Do not include personal data about real customers.</li>
</ul>
<h3>Tips for a strong submission</h3>
<ul>
<li>Keep your numbers consistent across sections, for example by using the same landed cost in pricing and inventory.</li>
<li>Explain the reasoning behind each decision in one or two sentences.</li>
<li>Name the biggest risk you see in your plan and how you would test or reduce it.</li>
</ul>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion',$t$Niche and validation$t$,'description',$t$Clear positioning statement, relevant competitor research and a validation test or plan with a success threshold set in advance.$t$,'points',20),
        jsonb_build_object('id','c2','criterion',$t$Unit economics and pricing$t$,'description',$t$Accurate landed cost, margin and contribution calculations with workings shown, and a justified price that leaves a positive contribution after marketing.$t$,'points',30),
        jsonb_build_object('id','c3','criterion',$t$Platform, fulfilment and returns$t$,'description',$t$Reasoned channel and platform choice with fees checked, a realistic fulfilment model, a correct reorder point calculation, a clear shipping structure and a fair returns policy.$t$,'points',30),
        jsonb_build_object('id','c4','criterion',$t$Service and metrics$t$,'description',$t$Practical support setup with a response target and saved replies, plus a weekly metrics sheet with sensible first targets.$t$,'points',20)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', 'Write a one-page operating plan that applies every module to a real or planned store.', 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Bring everything together in a one-page operating plan for a real or planned online store. Read the instructions and the rubric before you start, and plan to spend at least 30 minutes on your submission.$t$));
end $$;
