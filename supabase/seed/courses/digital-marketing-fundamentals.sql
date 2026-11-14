-- Foremint Academy course content: Digital Marketing Fundamentals
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'digital-marketing-fundamentals';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'Digital Marketing Fundamentals',
    short_description = $t$Learn to plan and run digital marketing that fits your business: define your positioning, research your audience, create useful content, use social media and email, test paid ads, measure results and connect it all in a simple funnel. Practical, beginner-friendly and focused on decisions rather than hype.$t$,
    description = $h$<p>Digital marketing can feel like an endless list of platforms, tactics and trends. This course cuts through the noise by teaching you to think about marketing as a connected system, so you can make sound decisions for your own business instead of copying whatever is popular this month.</p>
<p>You will start with strategy: setting goals you can measure, positioning your offer against the real alternatives and writing a clear value proposition. Then you will learn to research your audience through customer interviews, reviews, online communities and search data, and turn that research into a practical customer profile and journey map.</p>
<p>With that foundation, you will plan content that answers real questions, learn the basics of search engine optimisation and choose social platforms that suit your audience and your capacity. You will build an email list with a useful lead magnet, write a welcome sequence and understand how paid advertising works, including auctions, targeting, budgets and how to run a small, controlled test. Finally, you will set up analytics and campaign tracking and connect everything into a simple funnel that you can measure and improve.</p>
<h2>What makes this course different</h2>
<ul>
<li><strong>Decision-making over hype.</strong> You learn why each method works and when to use it, not shortcuts or so-called growth hacks.</li>
<li><strong>Beginner-friendly.</strong> Every concept is explained in plain language, with no prior marketing knowledge assumed.</li>
<li><strong>Practical from the first lesson.</strong> Each lesson ends with a short action you can apply to your own business.</li>
<li><strong>Platform-independent.</strong> Platforms and their features change often, so the course teaches principles you can apply anywhere and shows you how to check current rules and policies.</li>
</ul>
<h2>How the course works</h2>
<p>The course has five modules and twenty lessons. Modules one to four cover strategy and positioning, audience research, content and social media, and email and paid ads. Module five covers analytics and funnels, followed by a course quiz and a practical assignment in which you create a 30-day marketing plan. Lessons are short articles you can complete at your own pace, and the first lesson of every module is free to preview.</p>
<h2>What you need</h2>
<p>You do not need special software or a large budget. A product, service or project to practise on will help you get the most from the exercises, but you can also work with a realistic example. If you choose to try paid ads, you decide the budget, and the course shows you how to keep tests small and controlled.</p>
<p>By the end, you will have a clear strategy, a better understanding of your customers and a realistic plan for reaching them.</p>$h$,
    learning_outcomes = array[
      $t$Set marketing goals and choose metrics that reflect real business results$t$,
      $t$Position your offer clearly against the alternatives customers consider$t$,
      $t$Research your audience using interviews, reviews and search data$t$,
      $t$Plan, create and repurpose content for search, social media and email$t$,
      $t$Build an email list and write an effective welcome sequence$t$,
      $t$Plan and evaluate a small, controlled paid advertising test$t$,
      $t$Track campaigns with web analytics and UTM parameters$t$,
      $t$Design a simple funnel and improve its weakest stage$t$
    ],
    requirements = array[
      $t$No prior marketing experience is needed$t$,
      $t$A product, service or idea to promote, real or for practice$t$,
      $t$A computer with internet access and a free account on at least one social platform$t$,
      $t$A few hours a week to apply each lesson$t$
    ],
    target_audience = array[
      $t$Founders and small business owners doing their own marketing$t$,
      $t$Online sellers who want more consistent traffic and sales$t$,
      $t$Freelancers and consultants building a steady flow of clients$t$,
      $t$Developers and creators launching a product or side project$t$
    ],
    tags = array['digital marketing', 'content marketing', 'email marketing', 'social media', 'paid ads', 'analytics', 'marketing strategy', 'funnels'],
    level = 'beginner',
    estimated_duration_minutes = 256,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = $t$Digital Marketing Fundamentals for Beginners$t$,
    seo_description = $t$Learn digital marketing step by step: positioning, audience research, content, social media, email, paid ads, analytics and a simple funnel.$t$
  where id = c;

  -- Module 1
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Strategy and positioning', $t$Build the strategic foundation for your marketing: clear goals, a defined position and messages that make your offer easy to choose.$t$, 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Marketing as a system: from strategy to tactics', $t$See how strategy, messaging, channels and measurement fit together before you pick any tactic.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Many people start digital marketing by picking a tactic: posting on a social platform, running an ad or starting a newsletter. Without a strategy behind them, tactics produce scattered effort and results that are hard to explain. This lesson gives you a simple model for thinking about marketing as a system, which the rest of the course builds on.</p>
<h2>The four layers of a marketing system</h2>
<ol>
<li><strong>Strategy:</strong> who you serve, what problem you solve, why you are a better choice and what you want marketing to achieve.</li>
<li><strong>Messaging:</strong> the words and ideas that communicate that strategy consistently.</li>
<li><strong>Channels and tactics:</strong> where and how you reach people, such as search, social media, email, partnerships and paid ads.</li>
<li><strong>Measurement:</strong> the data that tells you what is working, so you can improve.</li>
</ol>
<p>Each layer depends on the one above it. A great ad cannot fix an unclear offer, and good analytics cannot tell you much if you have no goal to measure against.</p>
<h2>Owned, earned and paid media</h2>
<p>A useful way to group channels is by who controls them:</p>
<ul>
<li><strong>Owned media</strong> is what you control: your website, blog, email list and product. It builds long-term value.</li>
<li><strong>Earned media</strong> is attention you gain from others: shares, reviews, mentions, word of mouth and organic search rankings.</li>
<li><strong>Paid media</strong> is attention you buy: ads, sponsorships and paid placements. It is fast and controllable, but it stops when the spending stops.</li>
</ul>
<p>Social media profiles sit somewhere in between. You control what you post, but the platform controls who sees it and can change its rules at any time. That is why it is wise to move interested followers onto channels you own, especially your email list.</p>
<h2>Focus beats coverage</h2>
<p>Beginners often try to be everywhere at once. A better approach is to choose one or two primary channels that fit your audience and your strengths, do them well and expand only once they work. Consistency on a few channels usually beats occasional activity on many.</p>
<h3>Strategy before tactics</h3>
<p>When you hear about a new tactic, ask three questions: does it reach the people I serve, does it support my goal, and can I sustain it? If the answer to any of them is no, it can wait.</p>
<h2>Strategy checklist</h2>
<ul>
<li>Can you describe your target customer in one sentence?</li>
<li>Can you state the main problem your offer solves?</li>
<li>Do you know what action you want people to take next?</li>
<li>Have you chosen no more than two primary channels to start with?</li>
<li>Do you know how you will measure progress?</li>
</ul>
<p><strong>Try this:</strong> Write a one-paragraph marketing summary for your business covering who it is for, what it solves, the main channel you will use and the one number you most want to improve. Keep it; you will refine it throughout the course.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Setting marketing goals and choosing the right metrics', $t$Turn business goals into measurable marketing objectives and avoid vanity metrics.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>"Get more customers" is a wish, not a goal. Marketing becomes manageable when you connect it to a specific business outcome and decide in advance how you will measure progress. This lesson shows you how to set goals that guide decisions rather than decorate a slide.</p>
<h2>Start with the business outcome</h2>
<p>Begin with what the business actually needs: more sales of a particular product, more qualified enquiries, more trial sign-ups, more repeat purchases or better retention. Then ask what marketing can contribute. For example, if the business needs more consulting clients, a marketing objective might be to increase the number of qualified discovery calls booked each month.</p>
<h2>Write goals you can measure</h2>
<p>A practical goal includes four elements:</p>
<ul>
<li><strong>The metric:</strong> what you will count, such as email sign-ups or booked calls.</li>
<li><strong>The baseline:</strong> where you are today, measured rather than guessed.</li>
<li><strong>The target:</strong> where you want to be, based on your baseline and capacity rather than an arbitrary figure.</li>
<li><strong>The time frame:</strong> when you will review progress.</li>
</ul>
<p>If you have no baseline yet, make your first goal about establishing one: track the metric for a month before you set a target.</p>
<h2>Leading and lagging indicators</h2>
<p>Lagging indicators, such as revenue and customers won, tell you what has already happened. Leading indicators, such as visits from your target audience, email sign-ups or demo requests, change sooner and let you act before results arrive. Track a small number of each.</p>
<h3>Watch out for vanity metrics</h3>
<p>Some numbers feel good but do not connect to outcomes. Follower counts, impressions and likes can provide useful context, but they are easy to inflate and do not prove that the right people are interested. Ask of every metric: if this number went up, would the business be better off? If you cannot explain how, it should not be a headline goal.</p>
<h2>Goal-setting steps</h2>
<ol>
<li>Name the business outcome you need over the next quarter.</li>
<li>Choose one primary marketing metric that drives that outcome.</li>
<li>Pick two or three supporting leading indicators.</li>
<li>Record your current baseline for each.</li>
<li>Set a realistic target and a review date.</li>
<li>Decide where you will record the numbers each week.</li>
</ol>
<p><strong>Try this:</strong> Write one marketing goal for the next ninety days using the four elements above. Then list the leading indicators you will check weekly and where the data for each one will come from.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Positioning your offer against the alternatives', $t$Define what makes your offer the obvious choice for a specific customer.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Positioning is the place your offer occupies in a customer's mind compared with the alternatives. Good positioning makes marketing easier, because people quickly understand who you are for and why they should choose you. Weak positioning forces you to shout louder or compete on price.</p>
<h2>Start with the real alternatives</h2>
<p>Your competition is not only businesses that look like yours. Customers can also choose to do nothing, use a spreadsheet, hire someone, ask a friend or solve the problem in a completely different way. List the alternatives your customer would realistically use if you did not exist. Understanding them helps you explain your value in terms customers already recognise.</p>
<h2>Find your distinctive value</h2>
<p>Next, list what your offer does differently or better. Focus on capabilities, approach, specialisation or experience rather than generic claims such as "high quality" or "great service", which every competitor also makes. Then translate each feature into the value it creates. A feature is what the offer has; value is what the customer gets.</p>
<h3>Choose a specific audience</h3>
<p>Your differences matter most to some customers. Identify the group that cares most about what you do well. Being specific can feel risky, but a clear focus usually makes it easier for the right people to recognise themselves and for word of mouth to spread. You can broaden your focus later.</p>
<h2>A simple positioning statement</h2>
<p>Use a template to make your thinking explicit. It is an internal tool, not advertising copy:</p>
<p><em>For [specific customer] who [need or problem], [your offer] is a [category] that [key benefit]. Unlike [main alternative], it [main difference].</em></p>
<p>Test the statement with real customers or prospects. If they would describe you differently, listen carefully. Their words are usually more persuasive than yours.</p>
<h2>Positioning checklist</h2>
<ol>
<li>List at least five alternatives customers use, including doing nothing.</li>
<li>Identify two or three genuinely distinctive capabilities.</li>
<li>Translate each capability into customer value.</li>
<li>Describe the customer group that values them most.</li>
<li>Choose the category you want to be compared in.</li>
<li>Write your positioning statement.</li>
<li>Check it against how customers actually describe you.</li>
</ol>
<p><strong>Try this:</strong> Complete the positioning template for your business, then read it aloud to someone in your target audience. Ask them what they think you do and who it is for, and note any gaps between their answer and your intention.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Writing a value proposition and core messages', $t$Turn your positioning into clear words you can reuse across every channel.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once your positioning is clear, you need to express it in words customers understand. A value proposition and a small set of core messages give you consistent language for your website, social profiles, emails and ads. Consistency builds recognition, and clarity builds trust.</p>
<h2>The value proposition</h2>
<p>A value proposition is a short statement of the outcome you deliver, for whom, and why it is credible. On a website it is typically the headline and supporting line at the top of the home page. A useful structure is:</p>
<ul>
<li><strong>Headline:</strong> the main outcome or benefit, in plain language.</li>
<li><strong>Subheading:</strong> who it is for and how it works, in one or two sentences.</li>
<li><strong>Proof points:</strong> concrete reasons to believe, such as how the product works, your process, guarantees you genuinely offer or credentials that can be verified.</li>
</ul>
<p>Avoid jargon and superlatives. If a reader cannot tell what you offer within a few seconds, simplify.</p>
<h2>Core messages</h2>
<p>Core messages are three to five themes you repeat everywhere. Each one should connect a customer problem with how your offer helps. For example, a bookkeeping service might focus on saving owners time, reducing stress at tax time and giving them clearer numbers for decisions. Every piece of content you create should support at least one message.</p>
<h3>Use the voice of the customer</h3>
<p>The most effective wording often comes directly from customers. Phrases from reviews, support emails, interviews and forum posts show how people describe their problems. Use their words rather than internal terminology. You will learn how to gather this language in the next module.</p>
<h2>Honest, compliant claims</h2>
<p>Only make claims you can support. Advertising and consumer protection rules in most countries prohibit misleading claims, fake reviews and hiding important information, and platforms have their own policies too. If you mention results, describe them accurately and avoid implying that typical customers will achieve exceptional outcomes. Check the guidance published by your local advertising regulator or consumer protection authority.</p>
<h2>Messaging checklist</h2>
<ol>
<li>Write a headline that states the main outcome.</li>
<li>Write a subheading that says who it is for and how it works.</li>
<li>List three proof points you can genuinely support.</li>
<li>Define three to five core messages.</li>
<li>Replace jargon with customer language.</li>
<li>Check that every claim is accurate and verifiable.</li>
<li>Save everything in a single messaging document.</li>
</ol>
<p><strong>Try this:</strong> Draft a headline, subheading and three proof points for your offer. Ask three people to read only the headline and explain what you do. Revise it until they get it right.</p>$h$));

  -- Module 2
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Audience research', $t$Learn who your customers are, what drives their decisions and where to reach them, using interviews, online research and simple profiles.$t$, 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Defining your ideal customer', $t$Describe the specific people your marketing should reach, starting with assumptions you can test.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Everything in marketing gets easier when you know exactly who you are talking to. Your ideal customer is the person who gets the most value from your offer and is most valuable to your business. This lesson helps you define them, starting with educated assumptions that you will test in the following lessons.</p>
<h2>Who is your ideal customer?</h2>
<p>Look for people who have a strong need, can afford your offer, can make or influence the buying decision and are reachable through channels you can use. If you already have customers, start there: which ones were easiest to sell to, happiest with the result and most likely to refer others? Their common traits are your first clues.</p>
<h2>Useful ways to describe customers</h2>
<h3>Situation and trigger</h3>
<p>What is happening in their life or business that makes your offer relevant? What triggers them to look for a solution now rather than later? Triggers are especially useful because they tell you when people are ready to act.</p>
<h3>Goals and obstacles</h3>
<p>What are they trying to achieve, and what has stopped them so far? Common obstacles include time, money, knowledge, confidence and past bad experiences.</p>
<h3>Buying behaviour</h3>
<p>How do they look for solutions? Who else is involved in the decision? What do they need to feel confident before buying?</p>
<h3>Demographics and company details</h3>
<p>Age, location and role for individuals, or industry, size and team structure for businesses, can help with targeting. They are usually less predictive of buying than situation and motivation, though.</p>
<h2>Consumer and business buyers</h2>
<p>When you sell to consumers, the buyer and the user are often the same person and decisions can be quick and emotional. When you sell to businesses, several people may influence the decision, budgets and approvals matter, and the process tends to take longer. Your description should reflect who actually decides.</p>
<h2>Ideal customer checklist</h2>
<ul>
<li>The situation that makes your offer relevant</li>
<li>The trigger that starts their search</li>
<li>Their main goal and biggest obstacle</li>
<li>Who decides and who influences the purchase</li>
<li>Where they look for information and advice</li>
<li>What they need to see before they trust you</li>
<li>Which of these points are assumptions you still need to test</li>
</ul>
<p><strong>Try this:</strong> Write a half-page description of your ideal customer using the checklist. Mark each statement as "known" or "assumed". The next lessons will help you turn the assumptions into evidence.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Customer interviews that reveal real motivations', $t$Plan and run short interviews that uncover how people really decide to buy.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Talking to customers is the fastest way to replace guesswork with evidence. A handful of well-run conversations can reveal the language people use, what triggered their search and what nearly stopped them buying. This lesson shows you how to plan and run interviews that produce useful insight rather than polite opinions.</p>
<h2>Who to interview</h2>
<p>Aim for people who match your ideal customer profile. The most useful are recent customers, because their decision is fresh, and people who considered your offer but chose something else. If you have not launched yet, interview people who have recently tried to solve the problem you address. A small number of conversations often reveals clear patterns; keep going until you stop hearing new themes.</p>
<h2>Ask about the past, not the future</h2>
<p>People are poor predictors of their own future behaviour. "Would you buy this?" tends to get polite but unreliable answers. Instead, ask about what they actually did. Good questions include:</p>
<ul>
<li>"Tell me about the last time you dealt with this problem."</li>
<li>"What made you start looking for a solution then?"</li>
<li>"What else did you consider, and why?"</li>
<li>"What almost stopped you from going ahead?"</li>
<li>"How did you know it was the right choice?"</li>
<li>"How would you describe it to a colleague?"</li>
</ul>
<h3>Interview technique</h3>
<p>Keep the conversation relaxed and let the other person do most of the talking. Ask follow-up questions such as "Why was that important?" or "Can you give me an example?". Avoid pitching or defending your product. Silence is useful: people often add the most revealing detail after a pause.</p>
<h2>Respect and privacy</h2>
<p>Explain why you are asking, how long it will take and how you will use the information. Ask permission before recording and store notes securely. If you want to quote someone publicly, get their explicit consent first. Data protection laws in many places apply to the personal information you collect.</p>
<h2>Turning notes into insight</h2>
<p>After each interview, write down key quotes word for word, along with the trigger, the alternatives considered, objections and decision criteria. After several interviews, group similar points and look for patterns.</p>
<h2>Interview checklist</h2>
<ol>
<li>Recruit participants who match your ideal customer.</li>
<li>Prepare six to eight open questions about past behaviour.</li>
<li>Ask permission to take notes or record.</li>
<li>Listen more than you speak, and ask follow-ups.</li>
<li>Capture exact phrases, triggers and objections.</li>
<li>Summarise patterns after every few interviews.</li>
</ol>
<p><strong>Try this:</strong> Book three short conversations this week with customers or people who fit your profile. Use the questions above and record the exact words they use to describe their problem.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Researching online conversations, reviews and search data', $t$Use public sources to learn what your audience asks about, complains about and searches for.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your audience is already talking about their problems online. Reviews, forums, communities, social posts and search behaviour are rich sources of insight that you can study without asking anyone for their time. This lesson shows you where to look and how to organise what you find.</p>
<h2>Reviews of competing products</h2>
<p>Reviews on marketplaces, app stores and review sites show what people value and what disappoints them. Mid-range reviews are often the most useful because they balance praise and criticism. Look for repeated complaints you could solve and for the outcomes people celebrate, and note the exact phrases they use.</p>
<h2>Communities and forums</h2>
<p>Online communities, discussion forums, question-and-answer sites and groups on social platforms are where people ask for advice in their own words. Search for your topic and read the questions, the replies that receive the most agreement and the frustrations that keep coming up. Respect each community's rules: observe and contribute helpfully rather than promoting yourself.</p>
<h2>Search data</h2>
<p>What people type into search engines reveals their questions and intent. Start with free sources:</p>
<ul>
<li>the suggestions that appear as you type a query;</li>
<li>related questions and related searches shown on results pages;</li>
<li>keyword research tools, many of which offer free tiers or trials;</li>
<li>your own website's search console data, which shows the queries that already bring visitors.</li>
</ul>
<h3>Reading search intent</h3>
<p>Group queries by what the searcher wants. Informational searches seek knowledge, such as "how to price freelance work". Commercial searches compare options, such as "best invoicing tool for freelancers". Transactional searches are ready to act, such as a product name followed by "pricing". Each type of intent suits different content and offers.</p>
<h2>Organise your findings</h2>
<p>Collect everything in a simple spreadsheet with columns for the source, the exact quote or query, the theme and how you might use it. Over time, themes will emerge that feed your content plan, your messaging and even your product decisions.</p>
<h2>Online research checklist</h2>
<ol>
<li>Read reviews of at least three competing products or services.</li>
<li>Find two communities where your audience asks questions.</li>
<li>Collect at least twenty search queries related to your offer.</li>
<li>Label each query by intent.</li>
<li>Record exact phrases in your research spreadsheet.</li>
<li>Group your findings into themes.</li>
<li>Note which themes match or contradict your interviews.</li>
</ol>
<p><strong>Try this:</strong> Spend one focused hour collecting quotes and queries related to your offer. Identify the three most common problems and the words people use to describe them.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Turning research into a customer profile and journey map', $t$Combine your research into a practical profile and map the steps customers take before buying.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Research is only valuable if it changes what you do. In this lesson you will combine your interviews and online research into two practical tools: a customer profile that keeps your messaging focused, and a journey map that shows what content and touchpoints you need at each stage.</p>
<h2>Building an evidence-based customer profile</h2>
<p>A customer profile, sometimes called a persona, summarises a group of similar customers. Keep it short and grounded in what you learned rather than invented details. Include:</p>
<ul>
<li>the situation and trigger that start their search;</li>
<li>their goals, obstacles and objections;</li>
<li>how they describe the problem, in their own words;</li>
<li>where they look for information and whom they trust;</li>
<li>what they need to see before buying.</li>
</ul>
<p>Skip decorative details that do not affect decisions. If you serve distinct groups with different needs, create a separate short profile for each, but start with the most important one.</p>
<h2>Mapping the customer journey</h2>
<p>A journey map lays out the stages a customer passes through. A simple version uses four stages:</p>
<ol>
<li><strong>Awareness:</strong> they notice a problem or need and start looking for information.</li>
<li><strong>Consideration:</strong> they compare approaches and options.</li>
<li><strong>Decision:</strong> they choose a provider and buy.</li>
<li><strong>Retention and advocacy:</strong> they use the product, come back and recommend it.</li>
</ol>
<p>For each stage, note what the customer is thinking, the questions they ask, where they go for answers and what could make them drop out.</p>
<h3>Finding the gaps</h3>
<p>Compare the map with what you currently offer. You may find plenty of awareness content but nothing that helps people compare options, or a smooth purchase process followed by no onboarding at all. Gaps show you where to focus your marketing next.</p>
<h2>Keep it up to date</h2>
<p>Profiles and maps are working documents. Revisit them when you launch new offers, enter new markets or notice changes in what customers say.</p>
<h2>Profile and journey checklist</h2>
<ol>
<li>Draft the profile using only evidence from your research.</li>
<li>Add three to five exact customer quotes.</li>
<li>Map the four journey stages.</li>
<li>List the questions and channels at each stage.</li>
<li>Mark where you have no content or touchpoint.</li>
<li>Choose the single most important gap to fix first.</li>
</ol>
<p><strong>Try this:</strong> Create a one-page profile and a four-stage journey map for your ideal customer. Circle the biggest gap; you will use it to shape your content plan in the next module.</p>$h$));

  -- Module 3
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Content and social media', $t$Plan useful content, make it easier to find in search and build a sustainable social media routine.$t$, 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Content marketing: purpose, formats and pillars', $t$Learn how helpful content attracts customers and builds trust, and plan the themes you will cover.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Content marketing means creating useful material, such as articles, videos, guides, podcasts and posts, that attracts your audience and builds trust before they buy. Done well, it answers the questions customers already have and positions you as a helpful expert. Done poorly, it becomes a stream of posts nobody needs.</p>
<h2>What content should do</h2>
<p>Every piece of content should serve a purpose in the customer journey you mapped:</p>
<ul>
<li><strong>Awareness content</strong> helps people understand a problem or opportunity, for example explainers, how-to guides and checklists.</li>
<li><strong>Consideration content</strong> helps them evaluate approaches, for example comparisons, frameworks, detailed tutorials and examples from your own work.</li>
<li><strong>Decision content</strong> helps them choose you, for example product walkthroughs, pricing explanations, answers to common questions and demos.</li>
<li><strong>Retention content</strong> helps customers succeed after buying, for example onboarding guides and tips.</li>
</ul>
<h2>Content pillars</h2>
<p>Content pillars are three to five broad themes you return to repeatedly. They should sit where your expertise, your audience's needs and your offer overlap. For a freelance web developer, pillars might be website performance, choosing the right platform and working effectively with a developer. Pillars keep your content focused, help your audience know what to expect and make planning easier.</p>
<h2>Choosing formats</h2>
<p>Pick formats that suit your audience and your skills. Written articles are searchable and easy to update. Video demonstrates processes well and suits platforms built around it. Audio fits people who learn while commuting or exercising. Short posts help you stay visible. Start with one main format you can sustain, then adapt your best pieces into other formats.</p>
<h3>Quality over quantity</h3>
<p>One genuinely useful piece is worth more than many thin ones. Aim to answer a specific question thoroughly, include practical steps or examples and make the next action clear. Check your facts carefully, especially if you give advice on regulated topics such as health, finance or law.</p>
<h2>Content planning checklist</h2>
<ol>
<li>Choose three to five content pillars.</li>
<li>List customer questions under each pillar, taken from your research.</li>
<li>Tag each idea with its journey stage.</li>
<li>Choose one primary format.</li>
<li>Decide on a realistic publishing frequency.</li>
<li>Define the next step each piece should lead readers to.</li>
</ol>
<p><strong>Try this:</strong> Choose your content pillars and list five content ideas under each one, based on real questions from your research. Mark the three ideas you will create first and note the journey stage each one serves.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Search-friendly content: SEO basics', $t$Understand how search engines find and rank content and how to make yours easier to discover.$t$, 'article', 1, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Search engine optimisation (SEO) is the practice of making your content easier for search engines to understand and more useful for the people searching. Organic search can bring steady, relevant visitors over time without paying for each click. This lesson covers the fundamentals every beginner should know.</p>
<h2>How search engines work, in brief</h2>
<p>Search engines discover pages by following links and reading sitemaps, store them in an index and then rank indexed pages for each query using many signals. The exact ranking systems are not public and change frequently, but the major search engines consistently say they aim to reward helpful, reliable content created for people. Rather than chasing tricks, focus on being the best answer to a specific question.</p>
<h2>Keywords and intent</h2>
<p>Start from the queries you collected during audience research. For each piece of content, choose one main topic and the intent behind it. Look at the pages that currently rank for that query: their format and depth show what searchers expect. Then aim to create something clearer, more complete or more practical.</p>
<h2>On-page basics</h2>
<ul>
<li><strong>Title:</strong> a clear, descriptive page title that includes the main topic.</li>
<li><strong>Meta description:</strong> a short summary that encourages the click. Search engines do not always display it, but it still helps.</li>
<li><strong>Headings:</strong> a logical structure that makes the page easy to scan.</li>
<li><strong>Helpful body content:</strong> answer the question early, then add depth, examples and steps.</li>
<li><strong>Internal links:</strong> link related pages on your site so readers and search engines can find them.</li>
<li><strong>Readable addresses and image descriptions:</strong> short, descriptive URLs and alt text that describes each image.</li>
</ul>
<h2>Technical and trust basics</h2>
<p>Make sure your pages load quickly, work well on mobile devices and use a secure connection. Submit a sitemap and check for indexing problems using the free webmaster tools that major search engines provide. Show who is behind the content, keep it accurate and update it when things change.</p>
<h3>Avoid shortcuts</h3>
<p>Buying links, stuffing pages with keywords or publishing large volumes of low-value pages can breach search engine guidelines and harm your visibility. Sustainable SEO is slower, but its benefits build over time.</p>
<h2>SEO checklist for each page</h2>
<ol>
<li>Choose one main query and confirm its intent.</li>
<li>Review the current top results for format and depth.</li>
<li>Write a clear title and meta description.</li>
<li>Answer the main question early on the page.</li>
<li>Use headings, lists and examples for readability.</li>
<li>Add links to and from related pages.</li>
<li>Check the page on a mobile phone.</li>
<li>Review its search performance data after a few weeks.</li>
</ol>
<p><strong>Try this:</strong> Pick one content idea from your plan, research its main query and outline the page using the checklist. Note how your outline improves on the pages that currently rank.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing social platforms and building a posting rhythm', $t$Pick the right social platforms for your audience and post consistently without burning out.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Social media can help you reach new people, stay visible and build relationships. It can also consume endless time with little to show for it. The difference usually comes down to choosing the right platforms, having a clear purpose and posting in a rhythm you can sustain.</p>
<h2>Choosing platforms</h2>
<p>Start with where your audience already spends time and pays attention, which your research should have revealed. Then consider fit:</p>
<ul>
<li><strong>Audience fit:</strong> are your ideal customers active there, and in the right frame of mind?</li>
<li><strong>Format fit:</strong> does the platform favour formats you can produce well, such as short video, images, text or long-form video?</li>
<li><strong>Goal fit:</strong> is it better for discovery by new people, for nurturing an existing audience or for professional networking?</li>
<li><strong>Capacity fit:</strong> can you realistically create what the platform needs?</li>
</ul>
<p>Choose one primary platform to start with, perhaps with a second for repurposed content. Platform features, audiences and recommendation systems change, so revisit your choice periodically.</p>
<h2>How social reach works</h2>
<p>Most platforms decide what to show each person using recommendation systems that weigh signals such as engagement, relevance and how long people spend on a post. The details are not public and change often. The practical implications are fairly consistent, though: content that earns genuine attention and conversation tends to travel further, and the opening seconds or lines matter a great deal.</p>
<h2>Building a posting rhythm</h2>
<p>Consistency builds familiarity. Choose a frequency you can sustain for months, not weeks. A simple weekly mix might include:</p>
<ul>
<li>educational posts drawn from your content pillars;</li>
<li>behind-the-scenes or process posts that show how you work;</li>
<li>conversation starters that invite opinions or questions;</li>
<li>occasional direct offers or calls to action.</li>
</ul>
<h3>Engagement is part of the work</h3>
<p>Reply to comments, take part in relevant conversations and engage with others in your field. Social media is social; posting without interacting usually limits results.</p>
<h2>Platform rules and disclosure</h2>
<p>Follow each platform's community guidelines and advertising policies. If you partner with others or are paid to promote something, disclose it clearly, as local advertising rules require.</p>
<h2>Social media checklist</h2>
<ol>
<li>Choose one primary platform using the four fit questions.</li>
<li>Complete your profile with a clear description and link.</li>
<li>Set a sustainable posting frequency.</li>
<li>Plan a mix of post types based on your pillars.</li>
<li>Block time to engage, not just to publish.</li>
<li>Review results monthly and adjust.</li>
</ol>
<p><strong>Try this:</strong> Score two or three platforms against the four fit questions. Choose your primary platform and write down your posting frequency and weekly mix for the next month.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Creating, repurposing and scheduling content efficiently', $t$Build a simple workflow that turns one idea into several pieces of content.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Creating content consistently is hard when every post starts from a blank page. A simple workflow helps you produce more with less effort, keep quality high and make sure good ideas reach people across all your channels.</p>
<h2>Batch your work</h2>
<p>Switching between tasks costs time and focus. Instead of creating one post at a time, group similar work into dedicated sessions: one for planning, one for writing or recording, one for editing and one for scheduling. Many people find a weekly or fortnightly batch session easier to sustain than creating something new every day.</p>
<h2>Repurpose from a core piece</h2>
<p>Start with one substantial piece of content, such as a detailed article, video or guide, and adapt it for other channels. For example, a single tutorial article might become:</p>
<ul>
<li>a short video showing the key step;</li>
<li>a carousel or thread summarising the main points;</li>
<li>a quote or tip post for social media;</li>
<li>a section of your next email newsletter;</li>
<li>an answer to a question in a relevant community, where the rules allow it.</li>
</ul>
<p>Adapt rather than copy. Each platform has its own format, length and style, so rewrite the hook and structure to fit.</p>
<h2>Use a content calendar</h2>
<p>A content calendar can be a spreadsheet, a project board or a scheduling tool. Track the idea, pillar, journey stage, format, channel, status and publish date. Seeing everything in one place helps you balance topics and spot gaps.</p>
<h3>Scheduling tools</h3>
<p>Many platforms let you schedule posts natively, and third-party tools can schedule across several platforms at once. Scheduling frees you from posting manually, but it does not replace engagement. Check that scheduled posts still make sense if news or circumstances change.</p>
<h2>Maintain quality</h2>
<p>Create a short checklist to run every piece through before it goes live. Is it accurate, useful, clear, on-message and free of errors, and does it have a clear next step? Keep a swipe file of your best-performing posts and customer questions to spark future ideas.</p>
<h2>Content workflow checklist</h2>
<ol>
<li>Set up a content calendar with the columns above.</li>
<li>Schedule one batch session each week or fortnight.</li>
<li>Create one core piece per cycle.</li>
<li>Plan three to five repurposed pieces from it.</li>
<li>Run every piece through your quality checklist.</li>
<li>Schedule posts and block time to respond to comments.</li>
<li>Review which pieces performed best and why.</li>
</ol>
<p><strong>Try this:</strong> Take one idea from your content plan and map how you would turn it into a core piece plus three repurposed pieces for your chosen channels. Add them to a content calendar with dates.</p>$h$));

  -- Module 4
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Email marketing and paid ads', $t$Build and nurture an email list you own, and learn how to run small, controlled paid advertising tests.$t$, 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Building an email list with a lead magnet', $t$Give people a good reason to subscribe and collect sign-ups the right way.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your email list is one of the most valuable marketing assets you can own. Unlike social followers, subscribers do not depend on a platform's recommendation system to see your messages, and email lets you build a relationship over time. This lesson covers how to attract subscribers with permission and integrity.</p>
<h2>Why people subscribe</h2>
<p>People give you their email address when they expect value in return. A generic "subscribe to our newsletter" offers little reason to do so. A <strong>lead magnet</strong> is a specific, useful resource offered in exchange for signing up. Good lead magnets:</p>
<ul>
<li>solve one specific problem your ideal customer has;</li>
<li>can be used quickly, such as a checklist, template, short guide, calculator or mini course;</li>
<li>relate directly to what you sell, so subscribers are likely future customers;</li>
<li>deliver on their promise.</li>
</ul>
<h2>Where to place sign-up forms</h2>
<p>Put sign-up opportunities where interested people already are: within relevant articles, on a dedicated landing page, at the end of helpful content, in your social profiles and on your home page. Keep forms short; an email address and perhaps a first name is usually enough to start.</p>
<h3>The landing page</h3>
<p>A dedicated landing page for your lead magnet lets you link to it from anywhere and measure how many visitors sign up. Include a clear headline, what the subscriber will get, who it is for and a single form. Remove distractions such as unrelated navigation.</p>
<h2>Permission and privacy</h2>
<p>Email marketing is regulated. Requirements differ by country but commonly cover consent, clear identification of the sender, a working unsubscribe option and honest subject lines. In the UK and EU, data protection and electronic marketing rules set strict standards for consent; in the US, the CAN-SPAM Act sets rules for commercial email. Never buy email lists. Use an email service provider that handles unsubscribes automatically, and say clearly what people are signing up for. Check the current guidance from your national regulator.</p>
<h2>List-building checklist</h2>
<ol>
<li>Choose an email service provider that fits your needs and budget.</li>
<li>Create one lead magnet that solves a specific problem.</li>
<li>Build a simple landing page with a single form.</li>
<li>Add sign-up forms to your most visited pages.</li>
<li>Write clear consent wording and link to your privacy notice.</li>
<li>Test the full sign-up and delivery process yourself.</li>
<li>Track new sign-ups every week.</li>
</ol>
<p><strong>Try this:</strong> Brainstorm three lead magnet ideas based on your audience research. Choose the one that is quickest to create and most closely tied to your offer, and outline it on a single page.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Writing welcome sequences and regular newsletters', $t$Turn new subscribers into engaged readers with a welcome sequence and a consistent newsletter.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Collecting email addresses is only the start. What you send next determines whether subscribers become engaged readers and, eventually, customers. This lesson covers the two essentials: an automated welcome sequence and a regular newsletter.</p>
<h2>The welcome sequence</h2>
<p>New subscribers are usually at their most interested right after signing up. A welcome sequence is a short series of automated emails sent over the first days or weeks. A simple structure might be:</p>
<ol>
<li><strong>Delivery and welcome:</strong> deliver the lead magnet, say who you are and set expectations about what you will send and how often.</li>
<li><strong>Quick win:</strong> share a practical tip that helps them use the resource or make progress.</li>
<li><strong>Your story and approach:</strong> explain why you do this work and what makes your approach different.</li>
<li><strong>Proof and depth:</strong> share your most useful content or a detailed example from your own work.</li>
<li><strong>Offer:</strong> introduce your product or service, explain who it is for and invite them to take the next step.</li>
</ol>
<p>Ask a question in one of the early emails and invite replies. Replies give you research insight and start a genuine conversation.</p>
<h2>The regular newsletter</h2>
<p>After the welcome sequence, subscribers join your regular emails. Choose a frequency you can sustain and a consistent format, such as one main idea, one practical tip and one update. Each email should be useful on its own. Balance value and offers so that subscribers keep looking forward to hearing from you.</p>
<h3>Writing emails people read</h3>
<ul>
<li>Write subject lines that are clear and honest, not clickbait.</li>
<li>Get to the point in the first line.</li>
<li>Use short paragraphs and one main call to action.</li>
<li>Write as if to one person in your audience.</li>
<li>Check how each email looks on a mobile phone.</li>
</ul>
<h2>Key metrics</h2>
<p>Track click rate, replies, unsubscribes and, most importantly, conversions to sales or enquiries. Treat open rates with caution, because privacy features in some email apps can make them unreliable. Periodically re-engage or remove inactive subscribers to keep your list healthy.</p>
<h2>Email sequence checklist</h2>
<ol>
<li>Outline a welcome sequence of three to five emails.</li>
<li>Set expectations about content and frequency in the first email.</li>
<li>Include one clear call to action per email.</li>
<li>Set up the automation in your email service provider.</li>
<li>Choose a sustainable newsletter frequency and format.</li>
<li>Review clicks, replies and conversions monthly.</li>
</ol>
<p><strong>Try this:</strong> Write the first two emails of your welcome sequence. Send them to yourself and a friend, then refine them based on how they read on a phone.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Paid advertising basics: auctions, targeting and budgets', $t$Understand how ad platforms decide who sees your ads and what you pay.$t$, 'article', 2, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Paid advertising lets you reach specific people quickly and measure the response. It can also lose money quickly if you do not understand how it works. This lesson explains the core concepts shared by most ad platforms so you can approach paid ads with a clear head.</p>
<h2>Main types of digital ads</h2>
<ul>
<li><strong>Search ads</strong> appear when people search for specific terms. They capture existing demand, because the person is already looking.</li>
<li><strong>Social ads</strong> appear in feeds and stories on social platforms. They create demand by reaching people based on interests, behaviour or similarity to your customers.</li>
<li><strong>Display and video ads</strong> appear on websites, apps and video platforms, and are often used for awareness and retargeting.</li>
<li><strong>Marketplace ads</strong> promote products inside online marketplaces, close to the point of purchase.</li>
</ul>
<h2>How ad auctions work</h2>
<p>Most platforms sell ad space through automated auctions. Each time there is an opportunity to show an ad, the platform compares eligible advertisers. The winner is usually not simply the highest bidder: platforms also consider the expected relevance and quality of the ad and how likely the person is to respond. That is why a relevant, well-made ad can cost less to deliver than a poor one.</p>
<h3>Objectives and bidding</h3>
<p>You usually choose a campaign objective, such as traffic, leads or sales, and the platform optimises delivery towards it. Automated bidding strategies use the platform's data to adjust bids, and they often need a reasonable amount of conversion data to work well, which matters when budgets are small.</p>
<h2>Targeting</h2>
<p>Targeting options vary by platform and change as privacy rules evolve. Common approaches include keywords, interests, demographics and locations, audiences built from your own customer data with appropriate consent, lookalike audiences and retargeting people who visited your site. Many platforms increasingly combine broad targeting with their own automated optimisation.</p>
<h2>Key ad metrics</h2>
<ul>
<li><strong>Impressions and reach:</strong> how often, and to how many people, the ad was shown.</li>
<li><strong>Click-through rate:</strong> the share of impressions that led to a click.</li>
<li><strong>Cost per click and cost per result:</strong> what you paid for each click or desired action.</li>
<li><strong>Conversion rate:</strong> the share of clicks that became the action you wanted.</li>
<li><strong>Return on ad spend:</strong> revenue generated relative to ad cost.</li>
</ul>
<p>Before running ads, estimate what a customer is worth to you, so you know the most you can afford to pay to acquire one.</p>
<blockquote><p>Ad platform policies, targeting options and minimum budgets change frequently. Read each platform's current advertising policies and help pages before you launch.</p></blockquote>
<h2>Paid ads readiness checklist</h2>
<ol>
<li>Your offer and landing page already convert some organic visitors.</li>
<li>Conversion tracking is set up and tested.</li>
<li>You know roughly what a customer is worth.</li>
<li>You have a fixed test budget you can afford to lose.</li>
<li>You have read the platform's advertising policies.</li>
</ol>
<p><strong>Try this:</strong> Choose the ad type that best fits how your audience behaves and write down why. Then estimate the most you could pay to acquire one customer while staying profitable.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Running your first small ad test', $t$Plan, launch and evaluate a small, controlled paid campaign.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>The safest way to learn paid advertising is through a small, controlled test with a clear question, a fixed budget and a decision rule agreed in advance. This lesson walks you through planning, launching and evaluating your first campaign.</p>
<h2>Plan the test</h2>
<h3>Define a single question</h3>
<p>Good tests answer one question, such as "Can we get email sign-ups for our checklist at an acceptable cost from this audience?" or "Which of two headlines produces more enquiries?". Testing too many things at once makes the results impossible to interpret.</p>
<h3>Set the budget and duration</h3>
<p>Choose a total budget you could afford to lose entirely and a duration long enough for the platform to deliver the ads and for you to collect meaningful data. Check the platform's guidance on minimum budgets and learning periods, since these vary.</p>
<h3>Agree the decision rule</h3>
<p>Before launch, write down what result would make you continue, change or stop. For example: continue if the cost per sign-up is below your target, revise the creative if clicks are high but sign-ups are low, and stop if neither improves after a revision.</p>
<h2>Build the campaign</h2>
<ol>
<li>Choose the objective that matches your goal.</li>
<li>Set your audience, location and placements, and keep them simple.</li>
<li>Create two or three ad variations that differ in one main element.</li>
<li>Send traffic to a focused landing page that matches the ad's promise.</li>
<li>Add UTM parameters to your links and confirm conversion tracking works.</li>
<li>Set a daily or lifetime budget limit and double-check it before publishing.</li>
</ol>
<h2>Evaluate the results</h2>
<p>Resist making changes every day. Ad platforms need time to learn, and early results fluctuate. At your planned review point, look at the full path: impressions, click-through rate, landing page conversion rate and cost per result. If people click but do not convert, the landing page or offer may be the problem. If few people click, test new creative or a different audience.</p>
<p>Small tests rarely give statistically certain answers. Treat the results as directional evidence, look for large differences and confirm promising findings with a further test.</p>
<h2>Ad test checklist</h2>
<ul>
<li>One clear question, written down</li>
<li>A fixed budget and test period</li>
<li>A decision rule agreed before launch</li>
<li>Tracking tested from click to conversion</li>
<li>Variations that differ in one main element</li>
<li>Results recorded along with lessons learned</li>
</ul>
<p><strong>Try this:</strong> Write a one-page test plan for your first campaign covering the question, audience, budget, duration, ad variations, landing page and decision rule. Do not launch until every part is complete.</p>$h$));

  -- Module 5
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Analytics, funnels and your marketing plan', $t$Measure what matters, connect your channels into a simple funnel, then test your knowledge and build a 30-day plan.$t$, 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Measuring what matters: analytics and UTM tracking', $t$Set up basic analytics and campaign tracking so you know which efforts drive results.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Marketing without measurement is guesswork. You do not need complex dashboards to start, but you do need to know where visitors come from, what they do and which actions lead to results. This lesson covers analytics basics and the habit of tagging your links.</p>
<h2>Web analytics essentials</h2>
<p>A web analytics tool records visits to your site and what visitors do there. Many options exist, from free tools offered by search companies to privacy-focused alternatives and the analytics built into website and ecommerce platforms. Whichever you choose, learn these concepts:</p>
<ul>
<li><strong>Users and sessions:</strong> roughly, people and their visits.</li>
<li><strong>Traffic sources:</strong> where visitors came from, such as organic search, social, email, referral, paid or direct.</li>
<li><strong>Engagement:</strong> how visitors interact with pages, such as time spent or pages viewed.</li>
<li><strong>Conversions or key events:</strong> the actions that matter to you, such as sign-ups, enquiries or purchases.</li>
</ul>
<p>The most important setup step is defining conversions. Without them, analytics shows activity but not outcomes.</p>
<h2>UTM parameters</h2>
<p>UTM parameters are tags added to the end of a link that tell your analytics tool where a visit came from. The most common are:</p>
<ul>
<li><code>utm_source</code>: the specific source, such as a newsletter or a platform name.</li>
<li><code>utm_medium</code>: the type of channel, such as email, social or cpc.</li>
<li><code>utm_campaign</code>: the campaign name, such as a launch or seasonal promotion.</li>
<li><code>utm_content</code>: optional, used to tell apart different links or ads in the same campaign.</li>
</ul>
<p>Use them on links you share in emails, social posts, ads and partner placements. Keep naming consistent, for example always lowercase, and record your conventions in a shared document so reports stay clean.</p>
<h2>Privacy and consent</h2>
<p>Analytics and advertising tools often use cookies or similar technologies. Many jurisdictions require you to inform visitors and, in some cases, obtain consent before setting non-essential cookies. Publish a clear privacy notice and check the guidance from your data protection regulator.</p>
<h2>A simple measurement routine</h2>
<ol>
<li>Install analytics and confirm it records visits.</li>
<li>Define and test your key conversions.</li>
<li>Agree a UTM naming convention.</li>
<li>Tag every link you control that points to your website from elsewhere.</li>
<li>Review your primary metric and leading indicators weekly.</li>
<li>Carry out a deeper monthly review of channels and campaigns.</li>
<li>Write down what you will change as a result.</li>
</ol>
<p><strong>Try this:</strong> Create your UTM naming convention and build tagged links for your next email and social post. After a week, check whether those visits appear correctly in your analytics.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Building a simple funnel from first visit to purchase', $t$Connect your channels into a funnel and find the stage that most needs improvement.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A marketing funnel describes the stages people move through, from first hearing about you to buying and coming back. Thinking in funnels connects everything you have learned in this course: positioning, research, content, social media, email, ads and measurement. It also shows you where to focus your limited time.</p>
<h2>A simple funnel</h2>
<ol>
<li><strong>Attract:</strong> people discover you through search, social media, referrals or ads.</li>
<li><strong>Capture:</strong> interested visitors take a small step, such as subscribing for a lead magnet or following you.</li>
<li><strong>Nurture:</strong> email and content build understanding and trust.</li>
<li><strong>Convert:</strong> a clear offer and an easy purchase or enquiry process turn interest into customers.</li>
<li><strong>Retain and refer:</strong> onboarding, support and follow-up turn customers into repeat buyers and advocates.</li>
</ol>
<p>Real customer journeys are rarely this tidy. People skip stages, go back and forth and use several channels. The funnel is a planning tool, not a literal path.</p>
<h2>Measuring each stage</h2>
<p>Choose one metric per stage, such as visitors from target channels, sign-up rate, email click rate, the rate at which enquiries or checkouts become purchases, and repeat purchase or referral rate. Then calculate the conversion rate between stages. Comparing these rates over time shows where people drop out.</p>
<h3>Fix the biggest leak first</h3>
<p>It is tempting to push more traffic into the top of the funnel. Often, though, improving a weak middle or bottom stage is cheaper and more effective. If many people visit your landing page but few sign up, sending more traffic mostly wastes it. Improve the page first.</p>
<h2>Improving with experiments</h2>
<p>Run simple, focused experiments on the weakest stage: a clearer headline, a more relevant lead magnet, a shorter form, a stronger welcome email or a simpler checkout. Change one main element at a time, give each change enough time and record the result. Over months, small improvements across several stages add up.</p>
<h2>Funnel-building checklist</h2>
<ol>
<li>Map your current funnel stages and the channels at each one.</li>
<li>Choose one metric per stage.</li>
<li>Record current numbers and stage-to-stage conversion rates.</li>
<li>Identify the stage with the biggest drop-off.</li>
<li>List three possible improvements for that stage.</li>
<li>Run one experiment and review the result.</li>
<li>Repeat the process every month.</li>
</ol>
<p><strong>Try this:</strong> Draw your funnel on one page with a metric at each stage. Fill in whatever numbers you have, mark the stage you think is weakest and write down one experiment you will run this month to improve it.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What is the main purpose of positioning?$t$, $t$Positioning defines the place your offer holds in customers' minds compared with the alternatives, including who it is best for and why it is different. Channel choice, budgets and visual style come later.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$To define how your offer is distinct and who it is best for, compared with the alternatives$t$, true, 0),
    (qq, $t$To decide which social platform to post on$t$, false, 1),
    (qq, $t$To set the daily budget for ad campaigns$t$, false, 2),
    (qq, $t$To choose the colours and fonts for your brand$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Your goal is more paying customers. Which of these is most likely to be a vanity metric?$t$, $t$Follower count can rise without any increase in interest from the right people or in sales. Qualified enquiries, checkout conversion and repeat revenue connect directly to paying customers.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Follower count$t$, true, 0),
    (qq, $t$Number of qualified enquiries$t$, false, 1),
    (qq, $t$Conversion rate from checkout to purchase$t$, false, 2),
    (qq, $t$Revenue from repeat customers$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$In a customer interview, which question is most likely to give reliable insight?$t$, $t$Questions about past behaviour reveal what people actually did. Hypothetical questions about future buying tend to get polite but unreliable answers.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Tell me about the last time you dealt with this problem.$t$, true, 0),
    (qq, $t$Would you buy this if we built it?$t$, false, 1),
    (qq, $t$Do you like our product?$t$, false, 2),
    (qq, $t$How much would you pay for this in the future?$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Your email list is an owned channel, while your reach on a social platform depends on that platform's rules and recommendation systems.$t$, $t$True. You control your email list, while a social platform decides who sees your posts and can change its rules at any time. That is why moving followers onto your list is valuable.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, true, 0),
    (qq, $t$False$t$, false, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Someone searches for "best invoicing tool for freelancers". What type of search intent does this show?$t$, $t$The searcher is comparing options before choosing, which is commercial intent. Informational searches seek knowledge, and transactional searches show readiness to act or buy.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Commercial$t$, true, 0),
    (qq, $t$Informational$t$, false, 1),
    (qq, $t$Navigational$t$, false, 2),
    (qq, $t$Transactional$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of these practices support SEO in a sustainable way? Select all that apply.$t$, $t$Answering the question clearly, linking related pages and making pages fast and mobile-friendly all help both searchers and search engines. Buying links and keyword stuffing can breach search engine guidelines.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Answering the searcher's question clearly and early on the page$t$, true, 0),
    (qq, $t$Linking related pages on your own site$t$, true, 1),
    (qq, $t$Making pages fast and easy to use on mobile devices$t$, true, 2),
    (qq, $t$Buying large numbers of links from other sites$t$, false, 3),
    (qq, $t$Repeating the main keyword as many times as possible$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What is a lead magnet?$t$, $t$A lead magnet is a specific, useful resource, such as a checklist or template, offered in exchange for an email sign-up. Buying email lists is not permission-based and should be avoided.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$A specific, useful resource offered in exchange for an email sign-up$t$, true, 0),
    (qq, $t$A paid ad aimed at a competitor's customers$t$, false, 1),
    (qq, $t$A pop-up that appears when visitors try to leave a page$t$, false, 2),
    (qq, $t$A list of email addresses bought from a data provider$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of these should you decide before launching a small paid ads test? Select all that apply.$t$, $t$A good test has one clear question, a fixed budget you can afford to lose and a decision rule agreed in advance. No platform can guarantee a return, and changing settings daily makes results hard to interpret.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The single question the test should answer$t$, true, 0),
    (qq, $t$A fixed budget you can afford to lose$t$, true, 1),
    (qq, $t$A rule for when to continue, change or stop$t$, true, 2),
    (qq, $t$The guaranteed return the campaign will deliver$t$, false, 3),
    (qq, $t$A plan to change targeting every day$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What does the utm_medium parameter usually describe?$t$, $t$utm_medium describes the type of channel, such as email, social or cpc. The campaign name goes in utm_campaign and the specific source in utm_source.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The type of channel, such as email, social or cpc$t$, true, 0),
    (qq, $t$The name of the campaign$t$, false, 1),
    (qq, $t$The visitor's device type$t$, false, 2),
    (qq, $t$The page the visitor landed on$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$If many people visit your landing page but very few sign up, the best first step is usually to send more traffic to it.$t$, $t$False. Sending more traffic to a page that does not convert mostly wastes it. Improve the weakest stage, here the landing page, before scaling traffic.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, false, 0),
    (qq, $t$False$t$, true, 1);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$Ten questions covering strategy and positioning, audience research, content and social media, email and paid ads, and analytics and funnels. You need 70% to pass, and you will see an explanation for each answer after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'Create a 30-day marketing plan', $h$<p>In this assignment you will bring the whole course together into a focused 30-day marketing plan for a real business, product or side project. If you do not have one, choose a realistic example, such as a local service or a digital product, and state your assumptions clearly.</p>
<h2>What to submit</h2>
<ol>
<li><strong>Goal and metrics.</strong> One primary marketing goal for the 30 days, with its baseline, target and review date, plus two or three leading indicators you will track weekly.</li>
<li><strong>Positioning and audience.</strong> Your positioning statement, a short ideal customer profile and at least three real customer phrases gathered from interviews, reviews or search research. Describe where each phrase came from.</li>
<li><strong>Channel and content plan.</strong> Your primary channel and why you chose it, three content pillars and a calendar of what you will publish over the 30 days, including at least one core piece and how you will repurpose it.</li>
<li><strong>Funnel and email.</strong> A simple funnel from first visit to purchase, your lead magnet idea and an outline of a welcome sequence of at least three emails.</li>
<li><strong>Measurement and testing.</strong> Your UTM naming convention, the conversions you will track and one experiment you will run, with its question, budget if any, and decision rule.</li>
</ol>
<h2>Guidelines</h2>
<ul>
<li>Keep the plan realistic for the time and budget you actually have.</li>
<li>Do not invent statistics or results; label assumptions clearly.</li>
<li>Do not include anyone's personal data without their permission.</li>
</ul>
<h2>Format</h2>
<p>Submit your plan as text, as an uploaded document or spreadsheet, or as a link to a shared document. Aim for a plan that someone else could pick up and follow.</p>
<h2>How it will be assessed</h2>
<p>Your submission will be assessed against the rubric: clear goals, research-based positioning, a practical channel, content and funnel plan, and a sound approach to measurement and testing.</p>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion','Strategy and goals','description','Sets a clear goal with baseline, target and review date, and chooses leading indicators that connect to a business outcome.','points',25),
        jsonb_build_object('id','c2','criterion','Audience insight and positioning','description','Grounds the positioning statement and customer profile in real research, with sourced customer language.','points',25),
        jsonb_build_object('id','c3','criterion','Channel, content and funnel plan','description','Makes a focused channel choice and provides a practical 30-day calendar, repurposing plan, lead magnet and welcome sequence that fit the funnel.','points',30),
        jsonb_build_object('id','c4','criterion','Measurement and testing','description','Defines conversions, uses a consistent UTM convention and designs a focused experiment with a clear decision rule.','points',20)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', $t$Create a realistic 30-day marketing plan for your own business or project.$t$, 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Bring the whole course together into a realistic 30-day marketing plan that you can start using straight away.$t$));
end $$;
