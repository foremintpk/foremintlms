-- Foremint Academy course content: Complete SEO Framework
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'complete-seo-framework';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'Complete SEO Framework',
    short_description = $t$A practical, repeatable SEO process you can apply to any website: understand how search works, research keywords and intent, optimise pages, fix technical issues, build authority ethically, improve local visibility and measure what matters.$t$,
    description = $h$<p>Search engine optimisation (SEO) is not a bag of tricks. It is a repeatable process: understand how search engines discover and evaluate pages, learn what your audience is really looking for, and make your website the most useful, accessible answer you can. This course teaches that process step by step so you can apply it to a business website, an online store, a client project or your own portfolio.</p>
<h2>What you will learn</h2>
<ul>
<li><strong>How search works</strong> – crawling, indexing and ranking, what modern results pages look like, and how to set goals and baselines before you change anything.</li>
<li><strong>Keyword and intent research</strong> – finding the language your customers use, judging intent from the results page, prioritising keywords and mapping them to pages.</li>
<li><strong>On-page optimisation and content</strong> – titles, meta descriptions, headings, URLs, images, internal links and a content strategy built on experience, expertise, authoritativeness and trust (E-E-A-T).</li>
<li><strong>Technical SEO</strong> – robots.txt, sitemaps, noindex and canonical tags, Core Web Vitals, structured data and the essential Google Search Console reports.</li>
<li><strong>Authority and local SEO</strong> – earning links and mentions ethically, and improving local visibility through your business profile, consistent information and genuine reviews.</li>
</ul>
<h2>How the course works</h2>
<p>Every lesson is a focused article with a practical checklist and a short "Try this" task you can complete on a real website. By the end you will have an SEO log, a keyword map, page-level improvements, a technical checklist and a measurement plan. A course quiz checks your understanding, and a practical assignment asks you to audit a real site and present a prioritised 90-day plan.</p>
<h2>Who it is for</h2>
<p>The course suits business owners, online sellers, freelancers, marketers, writers and developers. You do not need to code. A few lessons show short HTML examples so you can recognise what to look for and brief a developer clearly.</p>
<h2>An honest approach</h2>
<p>No one can guarantee rankings, and anyone who promises a specific position is overselling. Search engines also change their systems and features regularly. This course focuses on durable principles that align with search engines' published guidance, and shows you where to check the official documentation so your decisions stay current.</p>$h$,
    learning_outcomes = array[
      $t$Explain how search engines crawl, index and rank web pages$t$,
      $t$Research keywords and identify search intent for a real website$t$,
      $t$Map keywords to pages and write effective titles, headings and descriptions$t$,
      $t$Diagnose crawling, indexing and speed issues using Google Search Console$t$,
      $t$Add and validate structured data that matches visible content$t$,
      $t$Plan people-first content that demonstrates experience and trust$t$,
      $t$Earn links and local visibility without breaking search engine policies$t$,
      $t$Set SEO goals, track the right metrics and report progress clearly$t$
    ],
    requirements = array[
      $t$A website you can edit, or permission to review one$t$,
      $t$Basic comfort using a web browser and a content management system$t$,
      $t$Access to Google Search Console for the site, or the ability to request it$t$,
      $t$No coding experience needed; a few lessons show simple HTML examples$t$
    ],
    target_audience = array[
      $t$Business owners and online sellers who want more qualified visitors from search$t$,
      $t$Freelancers and marketers who offer, or plan to offer, SEO services$t$,
      $t$Developers and designers who want to build search-friendly websites$t$,
      $t$Content writers who want their work to be found$t$
    ],
    tags = array['seo','keyword-research','technical-seo','content-strategy','link-building','local-seo','google-search-console','digital-marketing'],
    level = 'all_levels',
    estimated_duration_minutes = 259,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = $t$Complete SEO Framework: a repeatable SEO process$t$,
    seo_description = $t$Learn a repeatable SEO process: keyword and intent research, on-page and technical SEO, Search Console, E-E-A-T, ethical link building and local SEO.$t$
  where id = c;

  -- Module 1
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'How search works and the SEO process', $t$Understand how search engines find, store and rank pages, and set up the process and measurement you will use for the rest of the course.$t$, 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'How search engines crawl, index and rank pages', $t$The three stages every page passes through before it can appear in search results.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Before you optimise anything, you need a clear mental model of what a search engine does. Every page that appears in search results has passed through three stages: it was discovered and crawled, it was processed and stored in an index, and it was selected and ranked for a specific query. Most SEO problems can be traced to one of these stages, so learning them gives you a diagnostic framework for everything that follows.</p>
<h2>Stage 1: crawling</h2>
<p>Search engines use automated programs, often called crawlers or bots, to fetch pages from the web. Google's crawler is called Googlebot. Crawlers discover new URLs mainly by following links from pages they already know and by reading XML sitemaps that site owners submit. A page with no links pointing to it and no sitemap entry may never be found.</p>
<p>Crawling can be blocked or slowed down. A <code>robots.txt</code> file can tell crawlers not to fetch certain paths, repeated server errors can make a crawler back off, and pages that only show content after complex scripts run may be harder to process. Modern search engines render JavaScript, but rendering takes extra resources and can happen later than the initial crawl.</p>
<h2>Stage 2: indexing</h2>
<p>After fetching a page, the search engine tries to understand it: the text, headings, title, images, links, structured data and language. It also decides whether the page duplicates another page and, if so, which version should be treated as the canonical one. The result is stored in the index, a very large database of pages.</p>
<p>Not every crawled page is indexed. Pages can be left out because they carry a <code>noindex</code> rule, because they are very similar to other pages, or because the search engine judges them to be of low value. Being crawled is not the same as being indexed.</p>
<h2>Stage 3: serving and ranking</h2>
<p>When someone searches, the engine looks for indexed pages that match the query and orders them using many signals. Google describes these broadly as the meaning of the query, the relevance of the content, its quality, the usability of the page and the context of the searcher, such as location and language. No one outside the search engine knows the exact weighting, and it changes over time. That is why building genuinely helpful, accessible pages is more reliable than chasing individual "ranking factors".</p>
<h3>A quick diagnostic checklist</h3>
<ul>
<li><strong>Can it be found?</strong> Is the page linked from other pages on your site and listed in your sitemap?</li>
<li><strong>Can it be crawled?</strong> Is it allowed in <code>robots.txt</code>, and does it return a 200 status code?</li>
<li><strong>Can it be indexed?</strong> Is it free of <code>noindex</code>, and does it declare a sensible canonical URL?</li>
<li><strong>Does it deserve to rank?</strong> Does it answer the searcher's need better than the pages already ranking?</li>
</ul>
<p>Google explains these stages in its official guide, <a href="https://developers.google.com/search/docs/fundamentals/how-search-works">How Google Search works</a>.</p>
<h3>Try this</h3>
<p>Pick one important page on your site and search Google for its exact title in quotation marks. If it does not appear, work through the four checklist questions and note which stage might be failing. You will learn precise tools for each stage in Module 4.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Reading the search results page', $t$What appears on a modern results page and how each feature affects the clicks you can earn.$t$, 'article', 1, 10, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Ranking is only half the story. What searchers actually see is a results page made up of many different elements, and each one changes how much attention a regular organic listing receives. Before you choose targets or report on performance, you need to understand what the results page looks like for the searches you care about.</p>
<h2>The main building blocks</h2>
<ul>
<li><strong>Organic results</strong> – the standard listings, usually a title link, the site name or URL, and a snippet of text. Most SEO work aims to improve these.</li>
<li><strong>Paid results</strong> – ads, labelled as sponsored. They are bought through an advertising platform and are separate from organic ranking.</li>
<li><strong>Rich results</strong> – organic listings enhanced with extra details such as review stars, prices, availability or event dates, often powered by structured data.</li>
<li><strong>Local results</strong> – a map with nearby businesses, drawn largely from business profiles, shown for searches with local intent.</li>
<li><strong>Other features</strong> – image and video carousels, "People also ask" boxes, featured snippets, shopping listings, news and discussion results.</li>
<li><strong>AI-generated summaries</strong> – some search engines show AI-generated overviews for certain queries, with links to sources. Google states that the same fundamentals, helpful content that can be crawled and indexed, apply to appearing in these features.</li>
</ul>
<h2>Why this matters for your strategy</h2>
<p>A query where the first screen is filled with ads, a map and a video carousel will usually send fewer clicks to the first organic listing than a query with plain results. Some queries are answered directly on the page, so searchers may not click at all. That does not make those queries worthless, because visibility still builds awareness. But it should shape which queries you prioritise and how you measure success.</p>
<p>The results page also reveals intent. If every top result is a product category page, searchers want to shop, and a blog post is unlikely to compete. If the results are guides and videos, they want to learn. You will use this observation constantly in Module 2.</p>
<h3>Results differ by searcher</h3>
<p>Results vary by location, language, device and sometimes previous activity. Your own searches are a sample, not the full picture. Later in the course you will use Search Console data to see average positions across real searchers rather than relying on a single check from your desk.</p>
<h2>A results page review checklist</h2>
<ol>
<li>Search the query in a private browser window on both mobile and desktop.</li>
<li>Note which features appear above the first organic result.</li>
<li>Record the type of page that ranks: guide, product, category, tool, video or forum.</li>
<li>Note whether results are local, recent or a mix.</li>
<li>Write one sentence describing what the searcher seems to want.</li>
</ol>
<h3>Try this</h3>
<p>Choose three searches a potential customer might type to find a business like yours. Run the checklist for each and save your notes. You will reuse them when you research keywords and plan content.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'A repeatable SEO framework', $t$The five-stage cycle used throughout this course, and an honest view of what SEO can and cannot do.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Many people approach SEO as a list of disconnected tasks: tweak a title here, add a keyword there, buy a tool and hope. Results are more reliable when you follow a repeatable cycle, measure the effect of what you change and then start again. This lesson introduces the framework used throughout the course.</p>
<h2>The five stages</h2>
<ol>
<li><strong>Audit.</strong> Establish where you are. Can search engines crawl and index your important pages? What do they currently rank for? Which pages bring visitors and which bring none?</li>
<li><strong>Research.</strong> Learn what your audience searches for, what they expect to find and who you compete with on the results page.</li>
<li><strong>Optimise and create.</strong> Improve existing pages, fix technical problems and publish new content that fills genuine gaps.</li>
<li><strong>Build authority.</strong> Earn mentions, links and reviews by being worth referencing, and keep your business information consistent across the web.</li>
<li><strong>Measure and iterate.</strong> Track the metrics tied to your goals, learn what worked and feed it into the next audit.</li>
</ol>
<p>Each module maps onto one or more of these stages, and the final assignment asks you to run a complete cycle on a real site.</p>
<h2>What SEO can and cannot do</h2>
<p>SEO can help search engines find and understand your pages, help those pages match what people actually want, and make your site a better experience for visitors. Over time, that usually leads to more qualified traffic that you do not pay for per click.</p>
<p>SEO cannot guarantee a position. Search engines decide rankings, competitors improve too, and algorithms change. Be cautious of anyone who promises a specific ranking or a fixed date for results. SEO is also slower than advertising: changes can take weeks or months to be reflected, and new sites often need longer to build trust.</p>
<blockquote>Treat SEO as a long-term investment in the quality and discoverability of your website, not a switch you flip.</blockquote>
<h3>Prioritising your work</h3>
<p>You will always find more to fix than you have time for. Score each task on impact (how much it could help an important page or goal) and effort (how much time or budget it needs). Start with high-impact, low-effort items, such as fixing an important page that is accidentally blocked from indexing, before larger projects like a full content overhaul.</p>
<h2>Set up your SEO workspace</h2>
<ul>
<li>A spreadsheet or document to log findings, decisions and the dates of changes.</li>
<li>Access to Google Search Console and, ideally, a web analytics tool.</li>
<li>Access to your content management system, or a developer who can make changes.</li>
<li>A list of your most important pages: home, key products or services, and top content.</li>
</ul>
<h3>Try this</h3>
<p>Create your SEO log now. Add a "Pages" tab listing your ten most important URLs with their purpose, and a "Changes" tab with columns for date, page, change made and reason. Recording changes is the habit that makes later measurement meaningful.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Measuring and reporting SEO performance', $t$Choose goals and metrics, record a baseline and build a simple report before you change anything.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>If you do not measure where you start, you cannot tell whether your work made a difference. Measurement also keeps SEO connected to business outcomes rather than vanity numbers. Set it up now, before you begin optimising, so every later change has a baseline to compare against.</p>
<h2>Start from business goals</h2>
<p>Begin with what the website exists to do: generate enquiries, sell products, grow a mailing list or attract readers. Then choose SEO metrics that connect to that goal. A useful structure has three layers:</p>
<ul>
<li><strong>Visibility</strong> – impressions and average position for queries you care about, and the number of important pages indexed.</li>
<li><strong>Traffic</strong> – clicks from search, organic sessions to key pages and click-through rate.</li>
<li><strong>Outcomes</strong> – conversions from organic visitors, such as form submissions, sign-ups or sales.</li>
</ul>
<p>Visibility often moves first, traffic follows and outcomes come last. Reporting all three helps you explain progress honestly when outcomes have not yet changed.</p>
<h2>Where the data comes from</h2>
<h3>Google Search Console</h3>
<p>The Performance report shows clicks, impressions, click-through rate and average position, broken down by query, page, country and device. It reflects what happened in Google Search itself. You will explore it in depth in Module 4.</p>
<h3>Web analytics</h3>
<p>An analytics tool shows what visitors do after they arrive: which pages they view and whether they convert. Make sure conversions are configured as events or goals, and that you can filter to organic search traffic.</p>
<h3>Rank tracking, with care</h3>
<p>Third-party rank trackers check positions for chosen keywords from a set location. They help you spot trends but are a sample, because results vary by searcher. Treat tool metrics such as estimated traffic or "authority scores" as that tool's estimates, not data from the search engine.</p>
<h2>Building a simple report</h2>
<ol>
<li>Record a baseline: the last three months of clicks, impressions and conversions from organic search.</li>
<li>Compare like with like. Use month-over-month for short-term trends and year-over-year where your business is seasonal.</li>
<li>Annotate the report with changes from your log and known events such as site migrations or holidays.</li>
<li>Explain the numbers in plain language: what changed, the likely cause and the next action.</li>
<li>Keep it short. One page with a few charts and three to five insights beats a data dump.</li>
</ol>
<p>Be careful about cause and effect. Traffic can rise or fall because of seasonality, search engine updates or competitor changes, not just your work. Say what the data shows and how confident you are.</p>
<h3>Try this</h3>
<p>Write down one business goal for your site and the visibility, traffic and outcome metrics you will use to track it. Then record today's baseline values in your SEO log. If you do not yet have Search Console access, make getting it your first task.</p>$h$));

  -- Module 2
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Keyword and intent research', $t$Find out what your audience searches for, why they search and which page on your site should answer each need.$t$, 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Search intent: the starting point of keyword research', $t$Identify the need behind a query so your page type matches what searchers expect.$t$, 'article', 0, 11, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A keyword is just a string of words. What matters is the need behind it: the reason someone typed it. Search engines work hard to understand that need and favour pages that satisfy it. If your page does not match the intent, good writing and technical polish will not make up for it. That is why intent comes first in keyword research.</p>
<h2>The four common intent types</h2>
<ul>
<li><strong>Informational</strong> – the searcher wants to learn something, for example "how to price handmade jewellery" or "what is a canonical URL". Guides, tutorials and explainers usually rank.</li>
<li><strong>Navigational</strong> – the searcher wants a specific website or page, such as a brand name followed by "login". Usually only that brand can satisfy it.</li>
<li><strong>Commercial investigation</strong> – the searcher is comparing options before deciding, for example "best accounting software for freelancers". Comparisons, reviews and buying guides tend to rank.</li>
<li><strong>Transactional</strong> – the searcher is ready to act: buy, book, download or sign up, for example "buy linen shirt" or "emergency plumber near me". Product, category and service pages usually rank.</li>
</ul>
<p>Many queries mix intents, and intent can shift over time. Treat these categories as a thinking tool rather than strict labels.</p>
<h2>Reading intent from the results page</h2>
<p>The most reliable way to judge intent is to look at what currently ranks, because the results reflect what the search engine has learned searchers want. When you review a query, ask three questions:</p>
<ol>
<li><strong>Content type:</strong> are the top results blog posts, product pages, category pages, tools, videos or forum threads?</li>
<li><strong>Content format:</strong> are they step-by-step guides, lists, comparisons, reviews or landing pages?</li>
<li><strong>Content angle:</strong> is there a common hook, such as "for beginners", "free" or "for small businesses"?</li>
</ol>
<p>If nearly all the top results are product category pages, publishing an article for that query is an uphill battle. Create, or improve, the page type that matches.</p>
<h3>Intent and the customer journey</h3>
<p>Intent types line up with stages of the buying journey. Informational queries attract people early on, commercial queries attract people who are comparing, and transactional queries attract people who are ready. A healthy site usually has pages for each stage, linked together so visitors can move forward.</p>
<h2>Intent checklist for any keyword</h2>
<ul>
<li>Write the searcher's likely goal in one sentence.</li>
<li>Note the dominant content type, format and angle in the top results.</li>
<li>Decide which page type on your site should serve the query.</li>
<li>Check whether that page exists, needs improving or needs creating.</li>
<li>Skip queries where your business cannot genuinely satisfy the intent.</li>
</ul>
<h3>Try this</h3>
<p>Take the three searches you reviewed in Module 1 and classify each one by intent using the checklist. For each, note the page on your site that should rank, or write "missing" if you do not have one yet.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Finding keyword ideas from real sources', $t$Build a long list of candidate keywords from customers, search features, your own data and research tools.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Good keyword research starts with the language your customers actually use, not the jargon your business uses internally. The goal of this stage is a broad, messy list of candidates. You will evaluate and narrow it down in the next lesson.</p>
<h2>Start with seed topics</h2>
<p>Seed topics are the broad subjects your site covers. For a freelance bookkeeper they might be "bookkeeping", "self-employed tax", "invoicing" and "expenses". List five to ten seeds based on your products, services and the problems you solve. Each seed will grow into many specific queries.</p>
<h2>Free sources of keyword ideas</h2>
<h3>Your customers</h3>
<p>Read support emails, sales call notes, reviews, chat logs and questions from social media. Note the exact words people use to describe their problem. These phrases often reveal long-tail queries, longer and more specific searches with clearer intent, that tools miss.</p>
<h3>The search engine itself</h3>
<ul>
<li><strong>Autocomplete</strong> – type a seed and note the suggestions. Add question words such as "how", "why" or "best" to see more.</li>
<li><strong>People also ask</strong> – these expandable questions show related needs.</li>
<li><strong>Related searches</strong> – suggestions near the bottom of the results page point to adjacent topics.</li>
</ul>
<h3>Your own Search Console data</h3>
<p>If your site already has some visibility, the Performance report lists queries you appear for. Look for queries with many impressions but few clicks, or low average positions. Search engines already associate your pages with these topics, so they are often the quickest wins.</p>
<h3>Communities and competitors</h3>
<p>Forums, question-and-answer sites and social groups show how people discuss your topic in their own words. Competitor websites show which topics they cover; study their navigation and content hubs for ideas rather than copying their pages.</p>
<h2>Keyword research tools</h2>
<p>Tools add estimated search volume and suggest related terms. Google's Keyword Planner, available inside a Google Ads account, shows volume ranges. Third-party SEO tools offer larger databases and difficulty scores. All volume and difficulty numbers are estimates, useful for comparing keywords with each other rather than as precise forecasts.</p>
<h2>Organise as you collect</h2>
<ol>
<li>Create a spreadsheet with columns for keyword, source, seed topic and notes.</li>
<li>Paste ideas in without judging them yet.</li>
<li>Remove exact duplicates, but keep close variations for now.</li>
<li>Tag each keyword with a rough intent: informational, commercial, transactional or navigational.</li>
<li>Group keywords that share the same intent and would be answered by the same page.</li>
</ol>
<h3>Try this</h3>
<p>Choose one seed topic and spend 30 minutes collecting at least 40 keyword ideas from at least three of the sources above. Tag each with an intent, and mark the ideas that came from customers, as these are often the most valuable.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Evaluating and prioritising keywords', $t$Score keywords on relevance, competition and business value to decide what to target first.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A long list of keywords is only useful once you decide which ones to pursue. Prioritising stops you spending months on terms that will never bring customers, or that you have little realistic chance of competing for. This lesson gives you a simple scoring model you can run in a spreadsheet.</p>
<h2>Four questions for every keyword</h2>
<h3>1. Is it relevant?</h3>
<p>Would someone searching this be a good fit for what you offer, and could you genuinely produce the best answer? A high-volume keyword that is only loosely related to your business can bring visitors who never convert.</p>
<h3>2. Is there demand?</h3>
<p>Use estimated search volume to compare keywords, remembering that the numbers are approximations. Low-volume keywords are not useless. Specific, long-tail queries often convert well, and one page can rank for many related variations whose combined demand is larger than any single estimate suggests.</p>
<h3>3. Can you compete?</h3>
<p>Look at the current results page rather than relying only on a tool's difficulty score. Ask:</p>
<ul>
<li>Are the top results from very large, well-known brands or from sites similar to yours?</li>
<li>Do the ranking pages fully answer the query, or are they thin, outdated or off-target?</li>
<li>Are forums or small sites ranking? That can signal an opening for a genuinely helpful page.</li>
<li>Do ads, maps or videos push organic results far down the page?</li>
</ul>
<h3>4. What is it worth?</h3>
<p>Consider business value. A transactional keyword for your main service may be worth more than many informational ones. Informational keywords still matter for awareness, trust and earning links, so weigh them accordingly.</p>
<h2>A simple scoring model</h2>
<p>Give each keyword group a score from 1 to 3 for relevance, competitiveness (3 means easier to compete) and business value. Add a demand note rather than a score, because volume estimates vary between tools. Then sort by the total.</p>
<ol>
<li>Score relevance: 3 for your core offering, 2 for related topics, 1 for loosely related ones.</li>
<li>Score competitiveness after reviewing the results page.</li>
<li>Score business value based on intent and how close the searcher is to acting.</li>
<li>Highlight groups scoring 7 or more as priority targets.</li>
<li>Remove anything with a relevance score of 1.</li>
</ol>
<blockquote>Prioritise keywords you can genuinely satisfy, that matter to your business, and where the current results leave room for a better answer.</blockquote>
<h3>Quick wins versus long-term bets</h3>
<p>Split your shortlist into quick wins, such as improving pages that already rank on page two, and long-term bets, such as competitive commercial terms that need new content and authority. A good plan includes both, so you show early progress while building towards bigger goals.</p>
<h3>Try this</h3>
<p>Score the keyword groups from your previous exercise using the model above. Pick your top five priorities and, for each, write one sentence explaining why it made the cut.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Mapping keywords to pages and avoiding cannibalisation', $t$Assign each keyword group to one page, spot content gaps and stop your pages competing with each other.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once you have prioritised keywords, decide which page on your site will target each group. This is called keyword mapping. It turns research into a clear plan, reveals gaps where content is missing and prevents a common problem: several of your own pages competing for the same need.</p>
<h2>One intent, one primary page</h2>
<p>The core rule is simple: each distinct search intent should have one primary page. A page can, and usually will, rank for many keyword variations that share that intent. "Bookkeeping for freelancers", "freelancer bookkeeping tips" and "how freelancers do bookkeeping" probably belong to the same page. "Bookkeeping software for freelancers" has a different, commercial intent and may deserve its own comparison page.</p>
<h3>What is keyword cannibalisation?</h3>
<p>Cannibalisation happens when two or more of your pages target the same intent. Search engines may switch between them or choose the weaker one, and links and attention are split. Signs include two of your URLs swapping places for the same query in Search Console, or several near-identical posts on one topic.</p>
<p>Fixes depend on the situation:</p>
<ul>
<li><strong>Merge</strong> overlapping pages into one stronger page and permanently redirect (301) the old URL to it.</li>
<li><strong>Differentiate</strong> the pages so each clearly targets a distinct intent or audience.</li>
<li><strong>Consolidate signals</strong> by pointing internal links at the page you want to rank.</li>
</ul>
<p>Not every overlap is a problem. Two pages appearing for a broad query can be fine if they serve different needs.</p>
<h2>Building your keyword map</h2>
<ol>
<li>List your existing important URLs in a spreadsheet.</li>
<li>For each priority keyword group, record the primary keyword, a few secondary variations and the intent.</li>
<li>Assign the group to the existing page that best matches the intent.</li>
<li>Where no suitable page exists, mark the group as a content gap and note the page type needed, such as guide, category page or service page.</li>
<li>Check for clashes: if two groups map to one page, confirm they share an intent; if two pages target one group, choose one.</li>
</ol>
<h2>Using the map</h2>
<p>Your keyword map becomes the brief for the next module. For every mapped page you will optimise the title, headings and content to match the intent. For every gap you will plan new content. Revisit the map each time you run the audit cycle, because new queries emerge and your site changes.</p>
<h3>Map checklist</h3>
<ul>
<li>Every priority keyword group has exactly one primary page.</li>
<li>Every important page has a clear primary topic.</li>
<li>Content gaps are listed with the page type they need.</li>
<li>Possible cannibalisation cases are flagged for a decision.</li>
</ul>
<h3>Try this</h3>
<p>Build a keyword map for your top five priority groups. Search Console can help: in the Performance report, filter by a query and open the Pages tab to see which of your URLs already appear for it.</p>$h$));

  -- Module 3
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'On-page optimisation and content', $t$Make each page clear to searchers and search engines, connect your pages with internal links and plan content people trust.$t$, 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Writing title links and meta descriptions', $t$Craft the title and description that shape how your page appears in results and whether people click.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>The title and description are often a searcher's first contact with your page. In Google Search, the clickable headline of a result is called a title link and the text beneath it is the snippet. You do not fully control either, but the HTML you write is a strong input, and good versions help people decide that your page is the right answer.</p>
<h2>The title element</h2>
<p>The page title lives in the <code>&lt;title&gt;</code> element in the page head, usually set through a field in your content management system. Search engines use it to understand the page's topic, and it is commonly shown as the title link.</p>
<h3>Guidelines for strong titles</h3>
<ul>
<li>Give every page a unique title that describes its specific content.</li>
<li>Put the most important words first, including the main topic the page targets.</li>
<li>Write naturally. Repeating keywords makes titles look spammy and can lead search engines to rewrite them.</li>
<li>Include your brand name where helpful, often at the end after a dash or pipe.</li>
<li>Keep titles concise so the key message is visible; long titles may be truncated.</li>
</ul>
<p>Search engines sometimes generate their own title link from headings or other text, especially when a title is missing, vague, duplicated or does not match the content. If you notice rewrites, check whether your title accurately reflects the page.</p>
<h2>The meta description</h2>
<p>The meta description is a short summary in the page head, written as <code>&lt;meta name="description" content="..."&gt;</code>. Google has said it does not use the meta description for ranking, but it may be shown as the snippet, so it influences whether people click. Search engines often build a snippet from the page text instead when that better matches a particular query.</p>
<h3>Guidelines for useful descriptions</h3>
<ul>
<li>Summarise what the page offers and why it is useful in one or two sentences.</li>
<li>Include specific details: what is covered, who it is for and relevant facts such as price ranges or opening hours.</li>
<li>Make each description unique rather than one template applied across hundreds of pages.</li>
<li>Do not mislead. A click that bounces straight back is wasted.</li>
</ul>
<p>Google ignores the old <code>meta keywords</code> tag, so you do not need to spend time on it.</p>
<h2>Title and description checklist</h2>
<ol>
<li>Find pages with missing, duplicate or generic titles, such as "Home" or "Untitled".</li>
<li>Rewrite each title to state the page's main topic first, then your brand.</li>
<li>Write a specific, honest description for each priority page.</li>
<li>Check that the title, description and main heading all describe the same intent.</li>
<li>Note the date of each change in your SEO log.</li>
</ol>
<h3>Try this</h3>
<p>In Search Console, find a page with many impressions but a low click-through rate. Search for its main query, compare your result with competing listings and rewrite your title and description to be clearer and more specific. Log the change and check the click-through rate again in a few weeks.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Structuring pages: headings, content, URLs and images', $t$Organise on-page elements so people and search engines understand your content quickly.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once a searcher clicks, your page has to deliver. Good on-page structure helps visitors scan and find what they came for, and helps search engines understand the main topic and the parts within it. This lesson covers the core on-page elements beyond the title.</p>
<h2>Headings that outline the page</h2>
<p>Headings are the HTML elements <code>&lt;h1&gt;</code> to <code>&lt;h6&gt;</code>. Think of them as the outline of your page.</p>
<ul>
<li>Use one clear main heading, normally an <code>&lt;h1&gt;</code>, that states what the page is about. It usually closely matches the title.</li>
<li>Use <code>&lt;h2&gt;</code> headings for main sections and <code>&lt;h3&gt;</code> for subsections, in a logical order.</li>
<li>Write descriptive headings. "Pricing for small teams" says far more than "Section 2".</li>
<li>Do not use heading tags just to make text bigger; use styling for visual size.</li>
</ul>
<h2>Content that answers the query early</h2>
<p>Match the intent recorded in your keyword map and get to the point. Open with a short summary of what the page offers, then expand. Use short paragraphs, lists and tables where they make information easier to digest. Cover the topic fully, including the related questions you found in "People also ask", but do not pad text to reach a word count. There is no ideal length; the right length is whatever fully satisfies the searcher.</p>
<h2>Readable, stable URLs</h2>
<p>A good URL is short, readable and descriptive, such as <code>/guides/freelance-bookkeeping</code> rather than <code>/index.php?id=4821&amp;cat=7</code>. Use lowercase letters and hyphens between words. Most importantly, keep URLs stable. If you must change one, set up a permanent redirect from the old address so visitors and search engines can follow.</p>
<h2>Images and media</h2>
<ul>
<li><strong>Alt text</strong> describes an image for people using screen readers and helps search engines understand it. Write a short, accurate description, and leave it empty for purely decorative images.</li>
<li><strong>File names</strong> such as <code>linen-shirt-blue.jpg</code> are more meaningful than <code>IMG_0042.jpg</code>.</li>
<li><strong>Size and format</strong> affect speed. Compress images and use modern formats your platform supports.</li>
<li><strong>Context</strong> helps: place images near related text and add captions where useful.</li>
</ul>
<h2>On-page checklist</h2>
<ol>
<li>One descriptive main heading that matches the page intent.</li>
<li>Logical section headings that read like a summary when skimmed.</li>
<li>A clear opening that answers the core question or states the offer.</li>
<li>A short, readable URL, with redirects for any changes.</li>
<li>Descriptive alt text on meaningful images, and compressed files.</li>
<li>Content that is accurate, up to date and free of filler.</li>
</ol>
<h3>Try this</h3>
<p>Pick one priority page from your keyword map and read only its headings from top to bottom. If they do not tell a clear story about the page, rewrite them. Then check every image on the page for missing or vague alt text.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Internal linking and site architecture', $t$Use site structure and internal links to help visitors and crawlers reach your most important pages.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Internal links are links from one page on your site to another. They are one of the few signals you fully control. They help visitors navigate, help crawlers discover pages and help search engines understand which pages matter most and how topics relate.</p>
<h2>Why site architecture matters</h2>
<p>Site architecture is the way your pages are organised and connected. A clear structure usually looks like a pyramid: the home page links to main sections, sections link to categories or topic hubs, and those link to individual pages. Important pages should be reachable within a few clicks of the home page. Pages buried deep, or with no internal links pointing to them (often called orphan pages), are harder for both people and crawlers to find.</p>
<h3>Topic clusters</h3>
<p>A practical way to organise content is the topic cluster, or hub-and-spoke, model. A hub page gives an overview of a broad topic and links to detailed spoke pages, each covering a specific subtopic. The spokes link back to the hub and, where genuinely useful, to each other. This makes your coverage easy to navigate and shows how pages relate.</p>
<h2>Writing good internal links</h2>
<ul>
<li><strong>Use descriptive anchor text.</strong> Anchor text is the clickable text of a link. "Read our guide to freelance bookkeeping" is far more informative than "click here".</li>
<li><strong>Link where it helps the reader.</strong> Add links in body content where a visitor would naturally want to go deeper.</li>
<li><strong>Point links at your priority pages.</strong> Your keyword map tells you which pages matter most; make sure related pages link to them.</li>
<li><strong>Use crawlable links.</strong> Search engines reliably follow standard HTML links such as <code>&lt;a href="/guides/invoicing"&gt;</code>. Links that only work through JavaScript click handlers may not be followed.</li>
<li><strong>Avoid excess.</strong> A page crammed with hundreds of links makes each one less useful to readers.</li>
</ul>
<h3>Navigation and breadcrumbs</h3>
<p>Your main menu and footer appear on every page, so use them for your most important sections. Breadcrumbs, a trail such as <em>Home &gt; Guides &gt; Bookkeeping</em>, show visitors where they are and reinforce your structure.</p>
<h2>Internal linking checklist</h2>
<ol>
<li>List your priority pages from the keyword map.</li>
<li>For each, find three to five related pages that could link to it in context.</li>
<li>Add links with descriptive anchor text that reflects the target page's topic.</li>
<li>Look for orphan pages: important pages not linked from anywhere else.</li>
<li>Update internal links that point to redirected or broken URLs so they go straight to the final page.</li>
</ol>
<p>The Links report in Search Console shows which of your pages receive the most internal links. If a key page has very few, that is a clear signal to act.</p>
<h3>Try this</h3>
<p>Choose your most important commercial page. Add at least three contextual internal links to it from related pages, using descriptive anchor text, and record the change in your SEO log.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Content strategy and E-E-A-T', $t$Plan people-first content that shows experience, expertise, authoritativeness and trust.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Content is how you answer the needs uncovered in your keyword research. A content strategy decides what to create, for whom, in what order and how to keep it accurate. Google's guidance is consistent: its systems aim to reward content created primarily to help people, not content made mainly to attract search traffic.</p>
<h2>People-first content</h2>
<p>Google's guide to <a href="https://developers.google.com/search/docs/fundamentals/creating-helpful-content">creating helpful, reliable, people-first content</a> offers self-assessment questions. Paraphrased, they include:</p>
<ul>
<li>Does the content provide original information, research or analysis rather than rewording other sources?</li>
<li>Would a reader leave feeling they learned enough to achieve their goal?</li>
<li>Does it demonstrate first-hand experience or depth of knowledge?</li>
<li>Is it written for an audience who would find it useful if they came to your site directly?</li>
</ul>
<p>Warning signs include covering many unrelated topics in the hope that something ranks, summarising others without adding value, or writing to a word count because you heard it helps. Producing large volumes of low-value pages, whether by people or automation, can breach search engine spam policies.</p>
<h2>Understanding E-E-A-T</h2>
<p>E-E-A-T stands for <strong>experience, expertise, authoritativeness and trustworthiness</strong>. It comes from the guidelines Google gives to search quality raters, people who evaluate results to help Google assess its systems. It is not a single ranking factor or a score you can set, but it describes qualities Google's systems try to reward. Trust is the most important of the four.</p>
<h3>How to demonstrate it</h3>
<ul>
<li><strong>Experience:</strong> show that you have used the product, done the task or visited the place, with original photos, specific details and lessons learned.</li>
<li><strong>Expertise:</strong> have content written or reviewed by people with relevant knowledge, and show who they are with clear author information.</li>
<li><strong>Authoritativeness:</strong> become a recognised source over time through consistent, high-quality coverage and genuine references from others.</li>
<li><strong>Trust:</strong> be accurate, cite sources, make contact details and ownership easy to find, and keep transactions secure.</li>
</ul>
<p>Topics that could significantly affect health, finances, safety or well-being are held to a higher standard. If you publish in those areas, involve qualified reviewers.</p>
<h2>Building a content plan</h2>
<ol>
<li>Start from the content gaps in your keyword map.</li>
<li>Prioritise topics where you have genuine experience to share.</li>
<li>Write a brief for each piece: intent, audience, key questions, unique angle and planned internal links.</li>
<li>Set a publishing rhythm you can sustain.</li>
<li>Schedule reviews to update or merge outdated content, not just add new pages.</li>
</ol>
<h3>Try this</h3>
<p>Choose one content gap from your keyword map and write a one-page brief using the steps above. Include a section called "What we know from experience" listing at least three insights only your business could provide.</p>$h$));

  -- Module 4
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Technical SEO', $t$Make sure search engines can crawl, index and understand your site, and that it loads quickly for real visitors.$t$, 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Controlling crawling and indexing', $t$Use robots.txt, noindex, canonical tags, sitemaps and status codes correctly.$t$, 'article', 0, 14, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Technical SEO starts with access. If search engines cannot crawl your important pages, or are told not to index them, nothing else in this course will help those pages. Equally, letting crawlers waste time on endless duplicate URLs can slow the discovery of your best content. This lesson covers the main controls you have.</p>
<h2>robots.txt controls crawling</h2>
<p>The <code>robots.txt</code> file sits at the root of your domain, for example <code>https://example.com/robots.txt</code>, and tells crawlers which paths they may fetch. A simple file might contain these lines:</p>
<ul>
<li><code>User-agent: *</code></li>
<li><code>Disallow: /cart/</code></li>
<li><code>Sitemap: https://example.com/sitemap.xml</code></li>
</ul>
<p>Two points matter. First, <code>robots.txt</code> controls crawling, not indexing: a blocked URL can still be indexed, without its content, if other pages link to it. Second, it is not a security measure. Anyone can read it, so protect private content with authentication.</p>
<h2>noindex controls indexing</h2>
<p>To keep a page out of search results, use a <code>noindex</code> rule, either as a meta tag such as <code>&lt;meta name="robots" content="noindex"&gt;</code> or as an <code>X-Robots-Tag</code> HTTP header. The crawler must be able to fetch the page to see the rule, so do not also block it in <code>robots.txt</code>. Typical candidates are internal search results and thank-you pages.</p>
<h2>Canonical tags handle duplicates</h2>
<p>The same content can often be reached at several URLs, for example with tracking parameters or sort orders. A canonical tag, <code>&lt;link rel="canonical" href="https://example.com/page"&gt;</code>, tells search engines which version you prefer. It is a strong hint rather than a command, so support it with internal links, redirects and sitemap entries that all point to the same preferred URL.</p>
<h2>Sitemaps aid discovery</h2>
<p>An XML sitemap lists the URLs you want search engines to know about. Include only canonical, indexable pages that return a 200 status, and submit the sitemap in Search Console. It helps discovery but does not guarantee indexing.</p>
<h2>Status codes</h2>
<ul>
<li><strong>200</strong> – the page loaded successfully.</li>
<li><strong>301 or 308</strong> – permanent redirect, for pages that have moved for good.</li>
<li><strong>404 or 410</strong> – not found or gone, which is fine for pages that genuinely no longer exist.</li>
<li><strong>5xx</strong> – server errors; persistent errors can reduce crawling and need quick fixes.</li>
</ul>
<h3>Crawl and index checklist</h3>
<ol>
<li>Confirm important pages are not blocked in <code>robots.txt</code>.</li>
<li>Search templates for accidental <code>noindex</code> rules, a common problem after a site launch.</li>
<li>Check that each important page declares a sensible canonical URL.</li>
<li>Keep only indexable, canonical URLs in your sitemap.</li>
<li>Fix redirect chains and internal links to broken pages.</li>
</ol>
<h3>Try this</h3>
<p>Open your own <code>robots.txt</code> file in a browser and read every rule, confirming you intended to block each disallowed path. Then view the source of your home page and look for the robots meta tag and canonical link.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Site speed and Core Web Vitals', $t$Measure real-user experience with Core Web Vitals and fix the most common performance problems.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Slow, jumpy pages frustrate visitors and cost you enquiries and sales. Search engines want to send people to pages that offer a good experience, so page experience is one of many signals Google considers. It rarely outweighs relevance, but it can matter when results are otherwise similar, and it always matters to your visitors.</p>
<h2>The Core Web Vitals</h2>
<p>Core Web Vitals are metrics Google uses to describe real-world user experience. At the time of writing they are:</p>
<ul>
<li><strong>Largest Contentful Paint (LCP)</strong> – loading: how long the main content, often a hero image or headline, takes to appear.</li>
<li><strong>Interaction to Next Paint (INP)</strong> – responsiveness: how quickly the page responds visually after a tap, click or key press.</li>
<li><strong>Cumulative Layout Shift (CLS)</strong> – visual stability: how much content unexpectedly moves while the page loads.</li>
</ul>
<p>Google publishes a "good" threshold for each metric, assessed across real page loads, and the metrics are updated over time. Check the current definitions and thresholds in Google's documentation rather than numbers quoted in older articles.</p>
<h2>Field data and lab data</h2>
<p><strong>Field data</strong> comes from real users' browsers on real devices and networks, and it powers the Core Web Vitals report in Search Console. <strong>Lab data</strong> comes from a simulated test, such as Lighthouse in Chrome DevTools, and is ideal for debugging because it is repeatable. PageSpeed Insights shows both when enough field data exists. Aim to improve field data, and use lab tools to find causes.</p>
<h2>Common causes and fixes</h2>
<h3>Slow LCP</h3>
<ul>
<li>Large images: resize, compress and use modern formats.</li>
<li>Slow server response: use caching, a content delivery network or better hosting.</li>
<li>Render-blocking resources: reduce or defer non-critical CSS and JavaScript.</li>
<li>Lazy-loaded hero images: load the main above-the-fold image early instead.</li>
</ul>
<h3>Poor INP</h3>
<ul>
<li>Heavy JavaScript on the main thread: remove unused scripts and break up long tasks.</li>
<li>Too many third-party tags, such as chat widgets and trackers: remove what you do not need.</li>
</ul>
<h3>High CLS</h3>
<ul>
<li>Images and embeds without dimensions: set <code>width</code> and <code>height</code> attributes or reserve space with CSS.</li>
<li>Banners inserted above content after load: reserve their space in advance.</li>
<li>Late-loading web fonts that change text size: choose font loading settings carefully.</li>
</ul>
<h2>Speed improvement steps</h2>
<ol>
<li>Open the Core Web Vitals report in Search Console and note which URL groups are flagged.</li>
<li>Test a representative URL from each group in PageSpeed Insights.</li>
<li>List the top opportunities and estimate the effort for each.</li>
<li>Fix site-wide template issues first, since one change helps many pages.</li>
<li>Validate the fix in Search Console and monitor field data over the following weeks.</li>
</ol>
<h3>Try this</h3>
<p>Run your home page and one key product or service page through PageSpeed Insights on mobile. Write down the three biggest issues for each and which Core Web Vital they affect.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Structured data and rich results', $t$Describe your content in a machine-readable way and become eligible for enhanced search listings.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Structured data is a standardised way of describing a page in a format machines can read easily. It tells search engines, for example, that a page is a product with a price and availability, a recipe with a cooking time, or a local business with opening hours. Search engines can use it to understand content and to show rich results: listings with extra details.</p>
<h2>The vocabulary and the format</h2>
<p>Most structured data uses the <strong>schema.org</strong> vocabulary, a shared set of types such as <code>Product</code>, <code>Article</code>, <code>Organization</code>, <code>LocalBusiness</code>, <code>Event</code> and <code>BreadcrumbList</code>. Google recommends the <strong>JSON-LD</strong> format: a block of JSON inside a script element, kept separate from your visible HTML and easy to maintain.</p>
<p>A minimal description of an organisation might include properties like these:</p>
<ul>
<li><code>"@context": "https://schema.org"</code></li>
<li><code>"@type": "Organization"</code></li>
<li><code>"name": "Example Studio"</code></li>
<li><code>"url": "https://example.com"</code></li>
<li><code>"logo": "https://example.com/logo.png"</code></li>
</ul>
<p>Many content management systems and e-commerce platforms add common types automatically or through plugins. Check what yours already outputs before adding more, to avoid conflicting duplicates.</p>
<h2>Rules that matter</h2>
<ul>
<li><strong>Mark up visible content only.</strong> Structured data must describe what users can see on the page. Marking up hidden or misleading information, such as invented reviews, breaks Google's guidelines and can lead to a manual action.</li>
<li><strong>Include required properties.</strong> Each rich result type lists required and recommended properties in Google's documentation.</li>
<li><strong>Eligibility is not a guarantee.</strong> Valid structured data makes a page eligible for rich results, but the search engine decides whether to show them.</li>
<li><strong>Features change.</strong> Google has added, limited and retired rich result types over time. Check the current <a href="https://developers.google.com/search/docs/appearance/structured-data/search-gallery">structured data search gallery</a> before investing effort.</li>
</ul>
<h2>Choosing types for your site</h2>
<ul>
<li>Online store: <code>Product</code> with offer details, plus <code>BreadcrumbList</code>.</li>
<li>Local service business: <code>LocalBusiness</code> or a more specific subtype.</li>
<li>Publisher or blog: <code>Article</code> with author and date information.</li>
</ul>
<h2>Implementation steps</h2>
<ol>
<li>Review the search gallery and choose types that match your content.</li>
<li>Write JSON-LD for one page, using only information visible on that page.</li>
<li>Test it with the Rich Results Test and fix any errors.</li>
<li>Roll it out through the template so every similar page is covered.</li>
<li>Monitor the enhancement reports in Search Console for errors and warnings.</li>
</ol>
<h3>Try this</h3>
<p>Run your home page and one product, service or article page through the Rich Results Test. Note which structured data types are detected, any errors, and one type you could add that matches visible content.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Diagnosing problems with Google Search Console', $t$Use the key Search Console reports and tools to monitor performance and fix issues.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Google Search Console is a free service that shows how Google sees your site. It is the closest thing you have to data straight from the search engine, and you will use it at almost every stage of the SEO cycle. Other search engines offer similar tools, such as Bing Webmaster Tools, and setting those up is worthwhile too.</p>
<h2>Getting set up</h2>
<p>Add your site as a property and verify ownership. A <strong>domain property</strong> covers all subdomains and both <code>http</code> and <code>https</code>, and is verified with a DNS record. A <strong>URL-prefix property</strong> covers one exact address prefix and offers more verification methods. Grant colleagues access through user permissions rather than sharing logins, and submit your XML sitemap in the Sitemaps report.</p>
<h2>The reports you will use most</h2>
<h3>Performance</h3>
<p>Shows clicks, impressions, click-through rate and average position in Google Search. Filter by query, page, country, device and date. Comparing two date ranges is the quickest way to see what changed after an update to your site.</p>
<h3>Page indexing</h3>
<p>Shows how many known pages are indexed and why others are not, with reasons such as "Excluded by 'noindex' tag" or "Crawled - currently not indexed". Not every non-indexed page is a problem; focus on pages you actually want in search.</p>
<h3>URL Inspection</h3>
<p>Enter any URL from your property to see whether it is indexed, which canonical Google selected, when it was last crawled and how the page rendered. After fixing a page you can request indexing, which asks Google to recrawl it but does not guarantee inclusion.</p>
<h3>Experience and enhancements</h3>
<p>The Core Web Vitals report groups URLs by real-user performance, and enhancement reports list structured data errors for supported rich result types.</p>
<h3>Security issues and manual actions</h3>
<p>These reports tell you if Google has detected hacked content or malware, or if a human reviewer has applied a manual action for breaking spam policies. Check them first whenever traffic drops suddenly.</p>
<h2>A monthly Search Console routine</h2>
<ol>
<li>Check Security issues and Manual actions for alerts.</li>
<li>Review Page indexing for sudden rises in excluded or errored important pages.</li>
<li>Compare Performance with the previous period and the same period last year.</li>
<li>Find pages with high impressions and low click-through rate for title and description work.</li>
<li>Check the Core Web Vitals and enhancement reports for new issues.</li>
<li>Record findings and actions in your SEO log.</li>
</ol>
<p>Google's <a href="https://developers.google.com/search/docs">Search Central documentation</a> explains each report in detail and is updated when the tools change.</p>
<h3>Try this</h3>
<p>Use URL Inspection on your three most important pages. For each, note whether it is indexed, which canonical Google chose and whether it matches the one you declared. Investigate any mismatch using what you learned earlier in this module.</p>$h$));

  -- Module 5
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Authority, local SEO and your SEO plan', $t$Earn links and mentions ethically, improve local visibility and bring the whole framework together in a real audit.$t$, 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Earning links ethically', $t$Build authority with links and mentions people give freely, and avoid tactics that break search engine policies.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Links from other websites remain one of the ways search engines discover pages and judge their importance. A link from a respected, relevant site works a little like a recommendation. Because links matter, they are also widely abused, and search engines have explicit policies against manipulating them. Ethical link building focuses on deserving links rather than manufacturing them.</p>
<h2>What counts as link spam</h2>
<p>Google's <a href="https://developers.google.com/search/docs/essentials/spam-policies">spam policies</a> describe link schemes, including:</p>
<ul>
<li>Buying or selling links that pass ranking credit, including paying for guest posts mainly to get a link.</li>
<li>Excessive link exchanges ("link to me and I will link to you").</li>
<li>Using automated programs or services to create links.</li>
<li>Keyword-rich links hidden in widgets or footers distributed across many sites.</li>
<li>Low-quality directory or bookmark site links created only for ranking.</li>
</ul>
<p>Search engines are increasingly good at ignoring such links, and sites that persist can receive manual actions. The risk is rarely worth it.</p>
<h3>Qualifying links on your own site</h3>
<p>When you link out because of a payment, sponsorship or affiliate deal, add <code>rel="sponsored"</code> to the link. Use <code>rel="ugc"</code> for links in user-generated content such as comments, and <code>rel="nofollow"</code> when you do not want to vouch for a link.</p>
<h2>Ethical ways to earn links</h2>
<ul>
<li><strong>Create linkable assets.</strong> Original research, useful tools, templates and clear explainers attract links because others want to cite them.</li>
<li><strong>Digital PR.</strong> Offer genuinely newsworthy stories, expert commentary or data to journalists covering your field.</li>
<li><strong>Relationships.</strong> Suppliers, partners, associations and event organisers often list members or collaborators.</li>
<li><strong>Unlinked mentions.</strong> When a site mentions your brand without linking, a polite request to add a link is reasonable.</li>
<li><strong>Broken link replacement.</strong> If a relevant page links to a resource that no longer exists and you have a genuinely useful replacement, let the site owner know.</li>
</ul>
<h2>Evaluating a link opportunity</h2>
<ol>
<li>Is the site relevant to your audience or topic?</li>
<li>Would you want the link even if search engines did not exist, because it could send real visitors?</li>
<li>Is it a genuine publication with real readers, not a network of pages selling links?</li>
<li>Is any payment or exchange involved? If so, the link must be qualified.</li>
</ol>
<p>Judge success by the relevance of linking sites and the referral traffic they send, not by raw link counts or a third-party authority score.</p>
<h3>Try this</h3>
<p>List ten organisations you already have a real relationship with, such as suppliers, clients, partners or local groups. Check whether each mentions or links to you, and draft a short, friendly message to the most promising one.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Local SEO basics', $t$Help nearby customers find you through your business profile, consistent information, reviews and local pages.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>If customers visit your premises, or you serve a specific area, local SEO helps you appear when people nearby search for what you offer. Local results usually show a map and a short list of businesses, drawn largely from business profiles rather than websites alone. The principles are familiar: accurate information, relevance and trust.</p>
<h2>How local ranking works</h2>
<p>Google describes three main factors for local results:</p>
<ul>
<li><strong>Relevance</strong> – how well a business profile matches what the person searched for.</li>
<li><strong>Distance</strong> – how far the business is from the searcher or the location in the query.</li>
<li><strong>Prominence</strong> – how well known the business is, based on information from across the web, including links, articles and reviews.</li>
</ul>
<p>You cannot change your distance from a searcher, so focus on relevance and prominence.</p>
<h2>Your Google Business Profile</h2>
<p>A Google Business Profile is the free listing behind your appearance in Maps and local results. Claim and verify it, then complete it thoroughly:</p>
<ul>
<li>Use your real business name. Adding keywords or locations that are not part of it breaks Google's guidelines.</li>
<li>Choose the most accurate primary category and relevant additional ones.</li>
<li>Add your address, phone number, website and opening hours, including holiday hours. Businesses that serve customers only at their locations can hide their address and list service areas instead.</li>
<li>Describe your services and add real photos of your premises, team and work.</li>
</ul>
<h2>Consistent business information</h2>
<p>Your name, address and phone number, often shortened to NAP, should match across your website, business profile, social profiles and reputable directories. Conflicting details confuse customers and search engines. Show them clearly on your site and consider adding <code>LocalBusiness</code> structured data.</p>
<h2>Reviews</h2>
<p>Reviews influence prominence and customer decisions. Ask happy customers for honest reviews and make it easy with a direct link. Reply professionally, especially to negative reviews. Never post fake reviews, buy them or offer incentives in exchange; these practices break platform policies and, in many places, consumer protection law.</p>
<h2>Location pages</h2>
<p>If you serve several distinct areas, a page for each can help, provided each has genuinely useful, unique content such as local projects, staff or directions. Near-identical pages that only swap the town name are doorway pages and should be avoided.</p>
<h3>Local SEO checklist</h3>
<ol>
<li>Claim, verify and complete your business profile.</li>
<li>Audit NAP consistency on your site and major directories.</li>
<li>Set up a simple, honest review request process.</li>
<li>Reply to new reviews promptly.</li>
<li>Create location pages only where you genuinely serve distinct areas.</li>
</ol>
<h3>Try this</h3>
<p>Search on your phone for your main service plus your town. Compare your profile with the top three businesses shown: categories, photos, hours, reviews and description. List three improvements you can make this week.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which statement best describes the difference between crawling and indexing?$t$, $t$Crawlers first fetch pages; the search engine then analyses them and stores eligible pages in its index. A page can be crawled without being indexed.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Crawling is fetching pages; indexing is analysing and storing them so they can appear in results.$t$, true, 0),
    (qq, $t$Crawling is ranking pages; indexing is discovering new URLs.$t$, false, 1),
    (qq, $t$They are two names for the same process.$t$, false, 2),
    (qq, $t$Indexing always happens before a page is crawled.$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Your business is highly seasonal. Which comparison gives the fairest view of organic search performance this month?$t$, $t$Year-over-year comparisons put the same season side by side, so seasonal swings are not mistaken for the effect of your SEO work.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The same month last year$t$, true, 0),
    (qq, $t$Only the previous month$t$, false, 1),
    (qq, $t$A third-party authority score$t$, false, 2),
    (qq, $t$The number of keywords on the page$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Almost all the top results for a query are product category pages from online stores. What does this most likely tell you?$t$, $t$The results reflect what the search engine has learned searchers want. Here the intent is to browse and buy, so a category or product page is the page type most likely to compete.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Searchers mainly want to browse and buy, so a category or product page is the best fit.$t$, true, 0),
    (qq, $t$A long blog post will stand out and is the best choice.$t$, false, 1),
    (qq, $t$The query has no clear intent.$t$, false, 2),
    (qq, $t$Only paid ads can appear for this query.$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Google uses the meta description as a ranking factor, so adding more keywords to it will improve your rankings.$t$, $t$False. Google has said the meta description is not used for ranking. It can be shown as the snippet, so a clear, specific description can improve clicks, but keyword stuffing does not help.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, 'True', false, 0),
    (qq, 'False', true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of the following help demonstrate trustworthiness on a website? Select all that apply.$t$, $t$Trust is the most important part of E-E-A-T. Accurate, sourced content, clear ownership and contact details, and secure transactions all support it. Hiding authorship and publishing on unrelated topics to chase traffic work against it.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Making contact details and business ownership easy to find$t$, true, 0),
    (qq, $t$Citing reliable sources for factual claims$t$, true, 1),
    (qq, $t$Keeping checkout and account pages secure$t$, true, 2),
    (qq, $t$Hiding who wrote or reviewed the content$t$, false, 3),
    (qq, $t$Publishing many pages on unrelated topics to attract more searches$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$You want a thank-you page kept out of Google's search results. Which approach is correct?$t$, $t$A noindex rule keeps the page out of results, but the crawler must be able to fetch the page to see it. Blocking the page in robots.txt would hide the noindex rule from the crawler.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Add a noindex rule and leave the page crawlable$t$, true, 0),
    (qq, $t$Block the page in robots.txt and also add a noindex rule$t$, false, 1),
    (qq, $t$Add the page to your XML sitemap$t$, false, 2),
    (qq, $t$Add a canonical tag pointing to the page itself$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which Search Console tool shows whether a specific URL is indexed and which canonical URL Google selected for it?$t$, $t$URL Inspection reports the index status of a single URL, the canonical Google selected, the last crawl and how the page rendered.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$URL Inspection$t$, true, 0),
    (qq, $t$The Links report$t$, false, 1),
    (qq, $t$The Sitemaps report$t$, false, 2),
    (qq, $t$Manual actions$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Adding valid structured data guarantees that your page will be shown with rich results.$t$, $t$False. Valid structured data makes a page eligible for rich results, but the search engine decides whether to show them, and supported features change over time.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, 'True', false, 0),
    (qq, 'False', true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which of these link building activities is consistent with Google's spam policies?$t$, $t$Links that other sites choose to give because your content is genuinely useful are exactly what search engines want to reward. Paid, exchanged or automated links intended to manipulate rankings are link schemes.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Publishing original research that other sites choose to cite$t$, true, 0),
    (qq, $t$Paying a blog for a link without qualifying it as sponsored$t$, false, 1),
    (qq, $t$Joining a network where members link to each other's sites$t$, false, 2),
    (qq, $t$Using software to post links in forum comments automatically$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which actions help a local business improve its visibility in local results? Select all that apply.$t$, $t$A complete, accurate business profile, consistent NAP details and genuine reviews support relevance and prominence. Stuffing keywords into the business name and incentivising reviews break Google's guidelines.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Verifying and completing the business profile with accurate categories and hours$t$, true, 0),
    (qq, $t$Keeping name, address and phone number consistent across the web$t$, true, 1),
    (qq, $t$Asking real customers for honest reviews and replying to them$t$, true, 2),
    (qq, $t$Adding keywords and city names to the business name on the profile$t$, false, 3),
    (qq, $t$Offering discounts in exchange for five-star reviews$t$, false, 4);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$Ten questions covering how search works, keyword research, on-page and technical SEO, content, links and local SEO. You need 70% to pass, and you will see the correct answers with explanations after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'SEO audit and 90-day action plan', $h$<p>In this assignment you will run one full cycle of the SEO framework on a real website and turn your findings into a prioritised plan. Use your own site, an employer's or client's site with permission, or a small business site you can review from the outside.</p>
<h2>What to submit</h2>
<p>A report of roughly 1,500 to 2,500 words, as a document, slide deck or shared link, covering the five parts below. Screenshots from Search Console or testing tools are welcome. If you do not have Search Console access, use public tools and say so clearly.</p>
<h3>Part 1: Goals and baseline</h3>
<ul>
<li>The site's main business goal and the visibility, traffic and outcome metrics you would track.</li>
<li>Baseline figures where you have access, or the data you would need to collect.</li>
</ul>
<h3>Part 2: Keyword and intent research</h3>
<ul>
<li>At least 15 keywords grouped by intent, with your relevance, competitiveness and business value scores.</li>
<li>A keyword map assigning your top five groups to pages, including at least one content gap.</li>
</ul>
<h3>Part 3: On-page and content review</h3>
<ul>
<li>A review of three priority pages covering titles, meta descriptions, headings, internal links and images.</li>
<li>Rewritten titles and meta descriptions for each page, and one content brief for a gap.</li>
</ul>
<h3>Part 4: Technical review</h3>
<ul>
<li>Findings on robots.txt, the sitemap, indexing, canonical tags, Core Web Vitals and structured data.</li>
<li>Each issue rated by impact and effort.</li>
</ul>
<h3>Part 5: Authority, local and the 90-day plan</h3>
<ul>
<li>Three ethical link or mention opportunities and, if relevant, a short local SEO review.</li>
<li>A 90-day action plan listing tasks in priority order, who would do each one and how you will measure success.</li>
</ul>
<h2>Guidelines</h2>
<ul>
<li>Do not promise rankings or traffic figures. Describe the expected direction of change and how you will measure it.</li>
<li>Do not change a site you do not own or manage without permission.</li>
<li>Reference official search engine documentation wherever you rely on a specific rule.</li>
</ul>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion',$t$Research and intent analysis$t$,'description',$t$Keywords are relevant, grouped by intent and scored, then mapped to pages with clear reasoning and identified content gaps.$t$,'points',30),
        jsonb_build_object('id','c2','criterion',$t$On-page and technical findings$t$,'description',$t$Findings on titles, content, crawling, indexing, speed and structured data are accurate, specific and supported by evidence.$t$,'points',30),
        jsonb_build_object('id','c3','criterion',$t$Prioritised action plan$t$,'description',$t$The 90-day plan is realistic, ordered by impact and effort, and includes owners and measurable success criteria.$t$,'points',20),
        jsonb_build_object('id','c4','criterion',$t$Measurement, ethics and clarity$t$,'description',$t$Goals and baselines are defined, link and local tactics follow search engine policies, and the report is clear and concise.$t$,'points',20)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', $t$Audit a real website and present a prioritised 90-day SEO action plan.$t$, 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Put the whole framework to work: audit a real website, then present your findings and a prioritised 90-day SEO plan for feedback.$t$));
end $$;
