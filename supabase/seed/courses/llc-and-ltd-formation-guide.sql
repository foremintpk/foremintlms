-- Foremint Academy course content: LLC and Ltd Formation Guide
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'llc-and-ltd-formation-guide';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'LLC and Ltd Formation Guide',
    short_description = $t$Learn how to choose, form and maintain a US LLC or UK private limited company for an online business: structures, registered agents and offices, EINs, Companies House and HMRC registration, business banking, payment processors and ongoing compliance. General education that shows you exactly what to confirm with official sources.$t$,
    description = $h$<p>Setting up a company is one of the first serious decisions many online business owners make, and it is easy to get lost in conflicting advice. This course gives you a clear, practical understanding of how to choose, form and maintain a US limited liability company (LLC) or a UK private limited company, so you can make informed decisions and have better conversations with accountants and lawyers.</p>
<blockquote><p>This course is general education, not legal or tax advice. Rules vary by country and state and change regularly. Always confirm specifics with official sources, such as irs.gov, gov.uk and the relevant state's Secretary of State, or with a qualified professional.</p></blockquote>
<h2>What you will learn</h2>
<p>You will begin by understanding what a separate legal entity does and does not do for you, comparing operating as an individual with forming an LLC or limited company, and deciding where to form, including the extra questions that apply if you live outside the country of formation.</p>
<p>Next, you will walk through forming a US LLC: filing with the state, choosing a registered agent, writing an operating agreement, getting an EIN from the IRS and understanding how LLCs are classified for federal tax. You will then follow the equivalent path in the UK: incorporating with Companies House, understanding the roles of directors, shareholders and people with significant control, choosing addresses, completing identity checks and registering with HMRC.</p>
<p>The course then turns to money: why keeping personal and business finances separate matters, how to open a business bank account, how to set up payment processors and marketplaces correctly, and how owners pay themselves while keeping clean records. Finally, you will build a compliance calendar covering annual reports, confirmation statements, accounts and tax returns, and learn how to handle changes and close a company properly.</p>
<h2>How the course works</h2>
<ul>
<li>Five modules and twenty lessons, written in plain English for beginners.</li>
<li>Practical checklists and a short action at the end of every lesson.</li>
<li>A course quiz that tests key concepts, not memorised fees or dates.</li>
<li>A practical assignment in which you create a formation and compliance plan for your own business.</li>
</ul>
<h2>An approach built on official sources</h2>
<p>Fees, thresholds, forms and deadlines change, and they differ between states and countries. Instead of giving you numbers that may already be out of date, this course teaches you how each requirement works and exactly what to look up, so you can find current information on official websites and know which questions to bring to a professional.</p>$h$,
    learning_outcomes = array[
      $t$Compare operating as an individual with forming a US LLC or UK limited company$t$,
      $t$Choose a jurisdiction with a clear understanding of the trade-offs$t$,
      $t$Explain the steps to form a US LLC, from name check to EIN$t$,
      $t$Explain the steps to incorporate a UK company and register with HMRC$t$,
      $t$Describe the roles of registered agents, registered offices, directors and PSCs$t$,
      $t$Open business banking and payment accounts with the right documents ready$t$,
      $t$Keep personal and business finances separate with audit-ready records$t$,
      $t$Build a compliance calendar for recurring filings and know when to get professional help$t$
    ],
    requirements = array[
      $t$No prior legal or accounting knowledge is needed$t$,
      $t$A business idea or an existing online business you want to formalise$t$,
      $t$Internet access to official government websites for your country or state$t$,
      $t$Willingness to verify details with official sources or a qualified professional$t$
    ],
    target_audience = array[
      $t$Freelancers and consultants ready to move beyond working as individuals$t$,
      $t$Ecommerce and marketplace sellers setting up a company to sell online$t$,
      $t$Developers and creators launching digital products or software$t$,
      $t$Founders outside the US or UK researching a US LLC or UK company$t$
    ],
    tags = array['llc', 'limited company', 'business formation', 'companies house', 'ein', 'compliance', 'business banking', 'entrepreneurship'],
    level = 'beginner',
    estimated_duration_minutes = 254,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = $t$LLC and Ltd Formation Guide for Online Businesses$t$,
    seo_description = $t$Learn to form and run a US LLC or UK limited company: structures, registered agents, EIN, Companies House, HMRC, banking and compliance.$t$
  where id = c;

  -- Module 1
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Choosing the right structure', $t$Understand what a legal entity does for an online business and how to pick a structure and location that fit your situation.$t$, 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'What a business entity does for an online business', $t$Learn what forming a company actually changes, and what it does not.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>When you start selling online, you are usually trading as yourself. Forming a company creates a separate legal person that can sign contracts, hold a bank account, earn revenue and owe debts in its own name. That separation is powerful, but it is often misunderstood. This lesson explains what an entity really changes so you can decide whether, and when, you need one.</p>
<h2>What a separate legal entity gives you</h2>
<p>A US limited liability company (LLC) and a UK private company limited by shares (usually called a limited company or Ltd) are both legally separate from their owners. In practice, this tends to bring four benefits:</p>
<ul>
<li><strong>Limited liability.</strong> In general, the company's debts and obligations belong to the company. Your personal assets are not normally at risk for business debts, provided you respect the separation.</li>
<li><strong>Credibility.</strong> Some clients, marketplaces, wholesalers and payment providers prefer or require a registered business.</li>
<li><strong>Cleaner finances.</strong> A dedicated entity with its own bank account makes bookkeeping, tax filing and any later due diligence far simpler.</li>
<li><strong>Room to grow.</strong> A company can bring in co-owners, sign larger contracts and, in the case of an Ltd, issue shares to investors.</li>
</ul>
<h2>What an entity does not do</h2>
<p>Forming a company is not a shield against everything. Limited liability usually does not protect you from your own wrongful acts, from debts you personally guarantee or from obligations you ignore. Courts can also disregard the separation if you treat the company's money as your own. A company does not automatically reduce your tax either. Depending on where you live and how the entity is taxed, it can add paperwork and cost without saving anything.</p>
<p>An entity also comes with ongoing duties. You will file reports, keep records and pay recurring fees to keep it in good standing. If those duties are neglected, the company can be penalised or even removed from the official register.</p>
<h2>Signs it may be time to form</h2>
<p>There is no universal revenue figure at which you must incorporate. Instead, look for signals such as these:</p>
<ol>
<li>You are signing contracts where something going wrong could create real liability.</li>
<li>A platform, client or bank asks you for a registered business.</li>
<li>You are bringing in a partner and need clear ownership rules.</li>
<li>Your income is growing and an accountant has suggested a company may suit your situation.</li>
<li>You want to keep the business separate from your personal life for planning or privacy reasons.</li>
</ol>
<blockquote><p>This course is general education, not legal or tax advice. Rules vary by country and state and change over time. Confirm specifics with official sources or a qualified professional before acting.</p></blockquote>
<h2>Quick self-check</h2>
<ul>
<li>Do I understand what limited liability does and does not cover?</li>
<li>Can I name at least one concrete reason my business needs an entity now?</li>
<li>Am I prepared for annual filings and ongoing record keeping?</li>
<li>Do I know which country's rules apply to me as an owner?</li>
</ul>
<p><strong>Try this:</strong> Write down three reasons you are considering a company and, next to each, note whether an entity actually solves that problem. Keep the list; you will use it when comparing structures in the next lesson.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Sole proprietor, sole trader, LLC and Ltd compared', $t$Compare the most common structures for small online businesses in the US and UK.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Before you file anything, you need to know which structure you are choosing and why. This lesson compares the options most online business owners consider in the US and UK, focusing on liability, tax treatment, administration and privacy.</p>
<h2>Operating as an individual</h2>
<p>In the US, if you trade alone without forming an entity, you are a <strong>sole proprietor</strong>. In the UK, the equivalent is a <strong>sole trader</strong>. Both are simple to start: there is little to register beyond tax registration and any local licences. Business profit is generally taxed as your personal income.</p>
<p>The trade-off is that there is no legal separation. You and the business are the same person, so business debts and claims can reach your personal assets. For low-risk, early-stage work this is often acceptable; as risk and revenue grow, many owners move to an entity.</p>
<h2>The US limited liability company</h2>
<p>An LLC is created under state law. Its owners are called <strong>members</strong>. It offers limited liability with flexible management and, unusually, flexible tax treatment. By default, the IRS treats a single-member LLC as a "disregarded entity", meaning its income is reported by the owner, and a multi-member LLC as a partnership. An LLC can also elect to be taxed as a corporation and, if it meets the eligibility rules, as an S corporation.</p>
<p>LLCs suit many online businesses because they involve relatively few formalities. Most states do not require board meetings or share certificates.</p>
<h2>The UK private limited company</h2>
<p>A UK Ltd is registered with Companies House under the Companies Act 2006. It is owned by <strong>shareholders</strong> and run by <strong>directors</strong>, who are often the same person in a small business. The company pays Corporation Tax on its profits, and owners typically take money out through salary, dividends or both, each with its own tax treatment.</p>
<p>A Ltd is more formal than operating as a sole trader, and much of its information, including directors and annual accounts, appears on the public register.</p>
<h2>Comparing the options</h2>
<ul>
<li><strong>Liability:</strong> individual options offer none; an LLC or Ltd generally separates business debts from you.</li>
<li><strong>Tax:</strong> individuals pay personal tax on profit; an LLC's tax depends on its classification; an Ltd pays Corporation Tax, and owners are then taxed on what they take out.</li>
<li><strong>Administration:</strong> lowest for individuals, moderate for an LLC, higher for an Ltd.</li>
<li><strong>Privacy:</strong> varies widely; UK company details are largely public, while US disclosure depends on the state.</li>
</ul>
<blockquote><p>Tax outcomes depend on your residence, income and the rules in force at the time. Treat this comparison as a starting point and check current guidance on irs.gov or gov.uk, or with a qualified accountant.</p></blockquote>
<h2>Decision checklist</h2>
<ol>
<li>Where do you live and pay tax personally?</li>
<li>Where are your customers, and where will the business operate?</li>
<li>How much liability risk does your work create?</li>
<li>Will there be co-owners or investors?</li>
<li>How much administration are you willing to handle or pay for?</li>
</ol>
<p><strong>Try this:</strong> Draw a three-column table headed "Individual", "LLC" and "Ltd". Score each from one to five on liability protection, tax simplicity and admin effort for your situation, and note the questions you need a professional to answer.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing where to form: home country, US states and the UK', $t$Understand jurisdiction choices, including what changes if you form a company outside the country where you live.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once you know which type of entity you want, the next question is where to form it. For an online business the answer is less obvious than it seems, because your customers, your platforms and you yourself may all be in different places. This lesson walks through the main considerations.</p>
<h2>If you live in the US</h2>
<p>LLCs are created at state level, so you choose a state of formation. Many owners simply form in the state where they live and work. You will often see recommendations to form in a particular state known for low fees, privacy or business-friendly courts. Be careful: if you live and operate in one state but form in another, your home state may consider your LLC to be "transacting business" there. That usually means also registering it as a <strong>foreign LLC</strong> in your home state, with fees and reports in both places.</p>
<p>For most solo online businesses, forming in your home state is the simplest choice. Forming elsewhere can make sense in specific situations, such as raising investment or having no physical presence anywhere in the US.</p>
<h2>If you live in the UK</h2>
<p>A UK company is registered in one of three jurisdictions: England and Wales, Scotland, or Northern Ireland. Your registered office must be in the jurisdiction you choose. The company can still trade across the whole UK and internationally.</p>
<h2>If you live outside the US or UK</h2>
<p>Many founders form a US LLC or UK company to access payment processors, marketplaces or customers. This can be legitimate and useful, but it does not take you outside your own country's rules. Your home country may tax you on the company's profits, may treat the company as resident where it is managed, or may have special rules for foreign companies controlled by its residents. You may also face extra steps when opening bank accounts or applying for tax numbers.</p>
<blockquote><p>Cross-border structures are where mistakes become expensive. Rules vary and change. Before forming abroad, speak to a qualified adviser in your home country and check your own tax authority's guidance as well as irs.gov or gov.uk.</p></blockquote>
<h2>Factors to compare</h2>
<ul>
<li>Formation and ongoing registry fees, as published on the official site.</li>
<li>Annual filing requirements and any franchise or minimum taxes.</li>
<li>Whether you need a local address or registered agent.</li>
<li>Banking and payment provider access for owners in your situation.</li>
<li>How your home country treats income from the entity.</li>
<li>Privacy: which details become public.</li>
</ul>
<h2>Research steps</h2>
<ol>
<li>Visit the official business registry for each place you are considering. In the US this is usually the Secretary of State; in the UK it is Companies House on gov.uk.</li>
<li>Note formation requirements, recurring filings and where fees are published.</li>
<li>Check your home country's tax authority for guidance on owning a foreign company.</li>
<li>List the questions you cannot answer and take them to a professional.</li>
</ol>
<p><strong>Try this:</strong> Pick two possible jurisdictions and fill in the factors list for each, using only official sources. Note the date you checked each page, since requirements change.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Questions to answer before you form anything', $t$Prepare your name, ownership, addresses and budget so formation goes smoothly.$t$, 'article', 3, 10, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Filing the formation paperwork can take minutes online. The thinking that should come first takes longer. Owners who rush often end up amending documents, changing names or restructuring later, which costs time and money. This lesson gives you a pre-formation checklist to work through.</p>
<h2>Name and brand</h2>
<p>Your legal company name and your trading or brand name do not have to match, but you should check both. Registries reject names that are identical or too similar to existing companies, and some words are restricted or need permission. A name the registry accepts can still infringe someone else's trade mark, so search trade mark records as well: the United States Patent and Trademark Office in the US and the Intellectual Property Office in the UK. Check that matching domain names and social handles are available too.</p>
<p>US LLC names normally must include an identifier such as "LLC" or "Limited Liability Company". UK company names normally end with "Limited" or "Ltd".</p>
<h2>Ownership and roles</h2>
<p>Decide who owns what before you file. If you have co-founders, agree ownership percentages, who makes which decisions, what happens if someone leaves and how profits are shared. These points belong in an operating agreement for an LLC, or in the articles of association and a shareholders' agreement for an Ltd. Discussing them early prevents painful disputes later.</p>
<h2>Addresses and contacts</h2>
<p>You will need several addresses: a registered agent or registered office, a correspondence address and possibly separate service addresses for directors. Some of these become public. Decide whether to use your home address or a professional service.</p>
<h2>Budget and time</h2>
<p>Expect costs at formation and every year after. These can include registry fees, registered agent or office services, bookkeeping software, professional advice and any licences. Look up current fees on official websites rather than relying on blog posts, which go out of date quickly.</p>
<blockquote><p>Licensing and permit rules differ by location and industry. Check with your city, county or local council, and any regulator for your sector, to see whether your activity needs a licence.</p></blockquote>
<h2>Pre-formation checklist</h2>
<ol>
<li>Entity type and jurisdiction chosen, with your reasons written down.</li>
<li>Legal name checked on the registry and trade mark databases.</li>
<li>Ownership split and decision rules agreed in writing.</li>
<li>Registered agent or registered office arranged.</li>
<li>Identity documents ready for every owner and director.</li>
<li>Budget prepared for first-year and recurring costs.</li>
<li>List of licences or permits to research.</li>
<li>An accountant or adviser identified for questions.</li>
</ol>
<p><strong>Try this:</strong> Complete the checklist for your own business. For any item you cannot tick, write the next action and a target date, then move on to the formation module for your chosen country.</p>$h$));

  -- Module 2
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Forming a US LLC', $t$Walk through forming a US LLC, from filing with the state to choosing a registered agent, writing an operating agreement and getting an EIN.$t$, 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Forming an LLC step by step', $t$Follow the typical sequence for creating an LLC with a state filing office.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Every US state has its own LLC law and filing office, but the overall process is similar everywhere. This lesson gives you the typical sequence so you know what to expect, what to prepare and where to find the exact rules for your state.</p>
<blockquote><p>General education, not legal advice. Each state sets its own forms, fees and requirements, and they change. Always confirm the current process on your state's Secretary of State (or equivalent business filing office) website.</p></blockquote>
<h2>The typical formation sequence</h2>
<ol>
<li><strong>Choose and check your name.</strong> Search the state's business entity database to confirm the name is available, and include the required LLC designator.</li>
<li><strong>Appoint a registered agent.</strong> Every LLC needs a registered agent with a physical address in the state of formation. The next lesson covers this role.</li>
<li><strong>File the formation document.</strong> Most states call it the Articles of Organization; some use Certificate of Formation or a similar name. It usually asks for the LLC name, registered agent details, principal address, whether members or managers run the LLC, and organiser details.</li>
<li><strong>Pay the state filing fee.</strong> Fees vary widely between states, so check the official fee schedule.</li>
<li><strong>Receive confirmation.</strong> The state returns filed articles or a certificate. Keep a copy securely, because banks will ask for it.</li>
<li><strong>Complete post-formation steps.</strong> These include an operating agreement, an EIN, a bank account and any initial reports or publication requirements your state imposes.</li>
</ol>
<h2>Filing yourself or using a service</h2>
<p>Most states let you file online. Doing it yourself is usually the cheapest route and helps you understand your company. Formation services add convenience, bundle a registered agent and send reminders, but they charge on top of state fees and sometimes sell items you can get free, such as an EIN. Whichever route you take, read every field before submitting, because corrections often require an amendment and another fee.</p>
<h2>State-specific extras to look for</h2>
<p>Some states require an initial report soon after formation. A few require you to publish a notice of formation in local newspapers. Some charge an annual franchise tax or minimum tax regardless of profit, and many require periodic reports. Search your state's official site for these terms so nothing surprises you.</p>
<h2>Documents to keep together</h2>
<ul>
<li>Filed Articles of Organization or certificate</li>
<li>Registered agent agreement and contact details</li>
<li>Operating agreement, signed by all members</li>
<li>EIN confirmation from the IRS</li>
<li>Any initial report or proof of publication</li>
<li>Login details for the state filing portal, stored securely</li>
</ul>
<p><strong>Try this:</strong> Find your chosen state's business filing office website. Locate the formation form, the fee schedule and the page describing ongoing reports. Save the addresses and write a one-paragraph summary of what you found.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Registered agents: what they do and how to choose one', $t$Understand the registered agent role and compare acting as your own agent with using a commercial service.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Every LLC must name a registered agent in its state of formation. It is one of the most important and least understood roles in a company. If it goes wrong, you can miss a lawsuit or official notice and lose your company's good standing without realising.</p>
<h2>What a registered agent does</h2>
<p>A registered agent is the person or business officially designated to receive <strong>service of process</strong> (legal papers such as a summons in a lawsuit) and official correspondence from the state on behalf of the LLC. The agent's name and address are on the public record, so courts and government agencies always have a reliable way to reach the company.</p>
<p>Typical requirements, which vary by state, include:</p>
<ul>
<li>a physical street address in the state of formation, not just a PO box;</li>
<li>availability at that address during normal business hours;</li>
<li>consent to act as the agent.</li>
</ul>
<p>When papers arrive, the agent forwards them to you promptly. Missing a lawsuit can lead to a default judgment against your company, so this role matters.</p>
<h2>Your options</h2>
<h3>Acting as your own agent</h3>
<p>If you live in the state of formation, you can usually serve as your own agent. This avoids a recurring fee, but your address becomes public and you must be reachable during business hours, which can be awkward if you travel or work from home.</p>
<h3>Using a commercial registered agent</h3>
<p>Commercial agents provide an in-state address, scan and forward documents and often send compliance reminders. They are essential if you form in a state where you do not live. Compare them on reliability, how quickly they notify you, how they deliver documents, annual cost and how easily you can switch.</p>
<h3>Using a friend or colleague</h3>
<p>Many states allow this, but it is risky. If they move, forget or become unavailable, your company bears the consequences.</p>
<h2>Changing your agent</h2>
<p>States let you change your registered agent by filing a form, usually with a fee. Do not simply stop paying a commercial agent: if they resign and you do not appoint a replacement, your LLC can fall out of good standing.</p>
<blockquote><p>Registered agent rules are set by each state and can change. Check the official requirements on your Secretary of State's website before appointing anyone.</p></blockquote>
<h2>Registered agent checklist</h2>
<ol>
<li>Confirm your state's requirements on the official site.</li>
<li>Decide whether you can meet them yourself.</li>
<li>If using a service, compare at least three providers.</li>
<li>Confirm how you will be notified when documents arrive.</li>
<li>Add the renewal date to your compliance calendar.</li>
<li>Keep the agent's details with your company records.</li>
</ol>
<p><strong>Try this:</strong> List two commercial registered agent options for your chosen state and compare them on the criteria above. Note which one you would choose and why.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Operating agreements and member structure', $t$Learn what an operating agreement covers and why even single-member LLCs benefit from one.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>The operating agreement is the internal rulebook of your LLC. The state does not usually see it, and some states do not strictly require one, but it is among the most valuable documents you will create. It records how the company is owned and run, and banks and payment providers often ask to see it.</p>
<h2>Member-managed or manager-managed</h2>
<p>In a <strong>member-managed</strong> LLC, the owners run the business directly and can usually bind the company to contracts. This is common for solo founders and small partnerships. In a <strong>manager-managed</strong> LLC, members appoint one or more managers to run day-to-day operations, while members act more like passive owners. This suits businesses with investors who do not want an operational role. Your formation document may ask which model you are using, so decide early.</p>
<h2>What an operating agreement typically covers</h2>
<ul>
<li><strong>Ownership:</strong> each member's percentage or units, and initial contributions of cash, property or services.</li>
<li><strong>Management:</strong> who makes which decisions, and which decisions need a vote or unanimous consent.</li>
<li><strong>Profits and losses:</strong> how they are allocated and when distributions are made.</li>
<li><strong>Changes in membership:</strong> admitting new members, transfers and buyouts.</li>
<li><strong>Departure and death:</strong> what happens if a member leaves, becomes unable to work or dies.</li>
<li><strong>Dissolution:</strong> how the company is wound up and its assets distributed.</li>
</ul>
<h2>Why single-member LLCs need one too</h2>
<p>If you own the LLC alone, an operating agreement still helps. It shows that the LLC is a separate business run under its own rules, which supports limited liability. It sets out what happens to the company if you die or become incapacitated. It also gives banks and processors the ownership evidence they often ask for.</p>
<h2>Drafting it sensibly</h2>
<p>Templates are widely available and can be a reasonable start for a simple single-member LLC. For multiple members, unequal contributions, investors or anything unusual, have a lawyer review the agreement. The cost of advice now is small compared with a dispute between co-owners later.</p>
<blockquote><p>State law fills the gaps where your agreement is silent, and those default rules differ between states. Have a qualified attorney review anything beyond a simple single-member agreement.</p></blockquote>
<h2>Operating agreement checklist</h2>
<ol>
<li>Choose member-managed or manager-managed.</li>
<li>Record each member's ownership and contribution.</li>
<li>Define decision-making and voting rules.</li>
<li>Set out how and when distributions are made.</li>
<li>Cover exits, transfers, death and incapacity.</li>
<li>Sign and date it, and store it with your formation documents.</li>
<li>Review it whenever ownership or management changes.</li>
</ol>
<p><strong>Try this:</strong> Write plain-language answers to the six coverage points above for your LLC. Even if you later use a template or a lawyer, this summary will make the final document faster and cheaper to prepare.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Getting an EIN and understanding US tax classification', $t$Learn what an EIN is, how to obtain one from the IRS and how LLCs are classified for federal tax.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>An Employer Identification Number (EIN) is a nine-digit number the IRS uses to identify a business. Despite the name, you do not need employees to get one. Banks, payment processors and marketplaces usually ask for it, and many LLCs need one for federal filings. This lesson explains how to obtain an EIN and how the IRS treats LLCs for tax purposes.</p>
<blockquote><p>General education, not tax advice. Federal and state tax rules change. Confirm current requirements on irs.gov and with your state revenue department, or ask a qualified tax professional.</p></blockquote>
<h2>Applying for an EIN</h2>
<p>You apply directly with the IRS, which issues EINs free of charge. Be cautious of websites that look official but charge a fee to submit the same application. The IRS offers an online application for eligible applicants and other routes, such as Form SS-4, for those who cannot use it. Eligibility for the online route depends on factors such as whether the responsible party has a US taxpayer identification number, so non-US owners should check irs.gov for the current options.</p>
<p>You will need the LLC's legal name, state and date of formation, address, the responsible party's details and the reason for applying. Once the number is issued, save the confirmation securely; banks often ask for it.</p>
<h2>How LLCs are classified for federal tax</h2>
<p>An LLC is a creation of state law. For federal tax, the IRS applies default classifications:</p>
<ul>
<li><strong>Single-member LLC:</strong> by default a "disregarded entity", so its income and expenses are generally reported on the owner's return.</li>
<li><strong>Multi-member LLC:</strong> by default a partnership, which files an information return and gives each member a statement of their share.</li>
</ul>
<p>An LLC can elect to be taxed as a corporation, and an eligible LLC can elect S corporation status. These elections change how profits and owner pay are taxed and bring extra filings, so model them with an accountant before deciding.</p>
<h3>Foreign-owned LLCs</h3>
<p>If you are not a US person and own a US LLC, special information-reporting rules may apply even when the LLC owes little or no US tax. Penalties for missing these filings can be significant, so read the IRS guidance for foreign-owned disregarded entities and consider professional help.</p>
<h2>Other registrations to check</h2>
<p>Federal beneficial ownership reporting rules have changed several times, so check fincen.gov to see whether your company must file. Also check your state's revenue department for state tax accounts and sales tax registration.</p>
<h2>EIN and tax checklist</h2>
<ol>
<li>Form the LLC before applying for the EIN.</li>
<li>Apply only through irs.gov or an official IRS form.</li>
<li>Save the EIN confirmation with your company records.</li>
<li>Confirm your LLC's default tax classification.</li>
<li>Ask an accountant whether any election suits you.</li>
<li>Research state tax and sales tax registrations.</li>
<li>Add federal and state filing dates to your calendar.</li>
</ol>
<p><strong>Try this:</strong> On irs.gov, find the EIN application page and the guidance on LLC tax classification. Write down your expected default classification and two questions to ask a tax professional.</p>$h$));

  -- Module 3
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Forming a UK private limited company', $t$Learn how to incorporate a UK company with Companies House, understand officer roles, meet address and identity rules, and register with HMRC.$t$, 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Incorporating a limited company with Companies House', $t$Follow the main steps to register a private company limited by shares.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>In the UK, a private limited company is created by registering it with Companies House, the government registrar of companies. The process is mostly online and can be quick if you prepare properly. This lesson takes you through what you need and the order in which to do it.</p>
<blockquote><p>General education, not legal advice. Companies House requirements, fees and identity rules have been changing as company law reforms take effect. Always check the current guidance on gov.uk before you register.</p></blockquote>
<h2>What you need before you start</h2>
<ul>
<li><strong>A company name</strong> that is available, not too similar to an existing name and normally ending in "Limited" or "Ltd". Some words are sensitive and need approval.</li>
<li><strong>A registered office address</strong> in the UK jurisdiction where the company will be registered.</li>
<li><strong>A registered email address</strong> that Companies House can use to contact the company. It is not shown on the public register.</li>
<li><strong>At least one director</strong> who is an individual, plus details of any other directors.</li>
<li><strong>At least one shareholder</strong> and the share structure: the number, class and value of shares.</li>
<li><strong>People with significant control</strong> (PSCs), usually those who hold more than a set proportion of the shares or votes, or who otherwise have significant influence. gov.uk explains the tests.</li>
<li><strong>A SIC code</strong> describing the company's main business activity.</li>
<li><strong>Articles of association</strong>, the company's rulebook. Many small companies adopt the standard model articles.</li>
</ul>
<h2>The registration steps</h2>
<ol>
<li>Check the name using the Companies House search service.</li>
<li>Decide whether to register directly on gov.uk or through a formation agent or accountant.</li>
<li>Make sure every director and PSC has completed any required identity verification.</li>
<li>Enter the company details, officers, shareholders, PSCs and statement of capital.</li>
<li>Confirm the required statements and pay the registration fee shown on gov.uk.</li>
<li>Receive the certificate of incorporation, which shows the company number and date of incorporation.</li>
</ol>
<h2>Direct registration or an agent</h2>
<p>Registering directly is straightforward for a simple company using model articles. Formation agents and accountants can file on your behalf, provide addresses and help with bespoke articles or several share classes. Compare what each includes and make sure you understand everything filed in your company's name.</p>
<h2>After incorporation</h2>
<p>Companies House shares new company details with HMRC, and you should receive the company's Unique Taxpayer Reference (UTR), which you need for Corporation Tax. gov.uk explains what to do if it does not arrive. You should also set up the company's statutory registers and store the certificate of incorporation and articles safely.</p>
<h2>Incorporation checklist</h2>
<ol>
<li>Name checked and alternatives noted</li>
<li>Registered office and registered email arranged</li>
<li>Directors, shareholders and PSCs identified</li>
<li>Identity verification completed where required</li>
<li>Articles of association chosen</li>
<li>Certificate of incorporation stored securely</li>
</ol>
<p><strong>Try this:</strong> Search the Companies House register for your proposed name and two alternatives. Note which are available and whether any contain words that may need approval.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Directors, shareholders and people with significant control', $t$Understand the different roles in a UK company and the duties directors take on.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>In a small UK company, one person is often the sole director, the only shareholder and the only person with significant control. These are still three distinct roles with different rights and responsibilities. Understanding the difference helps you run the company properly and avoid personal liability.</p>
<h2>Shareholders: the owners</h2>
<p>Shareholders, also called members, own the company through its shares. They usually vote on major decisions, such as changing the articles or appointing directors, and receive dividends when the directors declare them. Shareholders are generally not liable for company debts beyond any amount unpaid on their shares, which is why share values at formation are often small.</p>
<h2>Directors: the people running it</h2>
<p>Directors manage the company and make decisions on its behalf. When you become a director, you take on legal duties set out in the Companies Act 2006. In summary, directors must:</p>
<ul>
<li>act within the company's constitution and use their powers for proper purposes;</li>
<li>act in the way they believe, in good faith, will promote the success of the company;</li>
<li>exercise independent judgement;</li>
<li>exercise reasonable care, skill and diligence;</li>
<li>avoid conflicts of interest and declare any interest in proposed transactions;</li>
<li>not accept benefits from third parties because of their role.</li>
</ul>
<p>Directors are also responsible for making sure the company keeps proper records and files its accounts, confirmation statement and tax returns on time. If a company is in financial difficulty, directors must give proper weight to creditors' interests. Getting this wrong can lead to personal liability or disqualification.</p>
<h2>People with significant control</h2>
<p>The PSC rules make it clear who really owns or controls a company. A PSC is typically someone who holds more than a set proportion of the shares or votes, can appoint or remove a majority of the directors, or otherwise has significant influence or control. gov.uk sets out the exact tests. The company must keep its own PSC register and keep the information at Companies House up to date.</p>
<h2>Public information and privacy</h2>
<p>Officers' names, a service address, month and year of birth, nationality and occupation appear on the public register. Your full date of birth and residential address are generally kept from public view if you provide a separate service address. Think about this before you file, because removing information later is not always possible.</p>
<blockquote><p>Director duties and liabilities are legal matters. If you are unsure whether a decision is in the company's interest, or whether the company can pay its debts, take advice from a qualified accountant or solicitor.</p></blockquote>
<h2>Roles checklist</h2>
<ol>
<li>List every director and confirm they understand their duties.</li>
<li>Record shareholders and the number and class of shares each holds.</li>
<li>Identify every PSC and record the nature of their control.</li>
<li>Choose a service address for each officer.</li>
<li>Set a reminder to update Companies House whenever officers or PSCs change.</li>
</ol>
<p><strong>Try this:</strong> Write a one-page summary of who holds each role in your company and what they are responsible for. If you have co-founders, share it and confirm that everyone agrees.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Registered office, service addresses and identity checks', $t$Choose suitable addresses and understand Companies House identity verification.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Addresses cause more confusion in UK company formation than almost anything else. A company has a registered office, and its directors and PSCs have service addresses and residential addresses. Each serves a different purpose and has different rules about what becomes public. Identity verification adds another layer of preparation.</p>
<h2>The registered office</h2>
<p>The registered office is the company's official address. Companies House and HMRC send letters there, legal documents can be served there and it appears on the public register. It must be a physical address in the same UK jurisdiction as the company's registration. Under recent reforms, it must also be an "appropriate address": post sent there should come to the attention of someone acting for the company, and delivery can be acknowledged. A PO box alone is not acceptable.</p>
<p>You can use your home, an accountant's office or a registered office service. Using your home puts that address on the public record; a service protects your privacy but costs money and must forward post reliably.</p>
<h2>Service and residential addresses</h2>
<p>Each director and PSC gives a service address, which is public, and a usual residential address, which is generally kept off the public register. The service address can be the registered office. Using a separate service address is the main way to keep your home address private.</p>
<h2>Registered email address</h2>
<p>Companies must also give Companies House a registered email address. It is used for official contact and is not published. Choose an address that will be monitored long term, rather than a personal inbox you might abandon.</p>
<h2>Identity verification</h2>
<p>Companies House has been introducing identity verification for directors, people with significant control and those who file on a company's behalf. Verification can be completed through the government's online service or through an authorised agent. Requirements, timelines and accepted documents are set out on gov.uk and have been phased in over time, so check what applies to you when you register or make changes.</p>
<blockquote><p>Address and identity rules are part of ongoing reforms to UK company law. Rules vary and change, so confirm the current requirements on gov.uk before you file.</p></blockquote>
<h2>Address and identity checklist</h2>
<ol>
<li>Choose a registered office that is physical, in the right jurisdiction and reliably monitored.</li>
<li>Decide whether you are comfortable with that address being public.</li>
<li>Choose a service address for each director and PSC.</li>
<li>Set up a long-term company email address for Companies House.</li>
<li>Check identity verification requirements and complete them early.</li>
<li>Write down how post at the registered office will reach you.</li>
</ol>
<p><strong>Try this:</strong> Map every address and email your company will use, mark which ones will become public and decide whether you need a registered office or mail forwarding service.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Registering with HMRC: Corporation Tax, PAYE and VAT', $t$Learn which HMRC registrations a new company may need and what triggers each one.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Registering with Companies House creates the company, but it does not complete your tax setup. HMRC, the UK tax authority, handles company taxes, and you may need several separate registrations depending on what the company does. This lesson outlines the main ones and what triggers them.</p>
<blockquote><p>General education, not tax advice. Thresholds, rates and deadlines change, often from one tax year to the next. Confirm current requirements on gov.uk or with a qualified accountant.</p></blockquote>
<h2>Corporation Tax</h2>
<p>A limited company pays Corporation Tax on its taxable profits. You must register the company for Corporation Tax within a set period after it starts doing business, which includes activities such as buying, selling, advertising or employing someone. You will normally need the company's Unique Taxpayer Reference (UTR) to register.</p>
<p>Each year the company files a Company Tax Return with HMRC and pays any tax due. The payment deadline and the filing deadline are different, so check both on gov.uk.</p>
<h2>PAYE as an employer</h2>
<p>If the company pays anyone through payroll, including you as a director, it may need to register as an employer for PAYE. Whether registration is required depends on how much you pay and other factors set out on gov.uk. Once registered, you report pay to HMRC each time you pay employees, using payroll software.</p>
<h2>VAT</h2>
<p>VAT registration becomes compulsory when the company's taxable turnover goes over the registration threshold, which is measured over a rolling period, or when you expect it to do so soon. You can also register voluntarily below the threshold, which can make sense if your customers are VAT-registered businesses or you pay significant VAT on costs. Special VAT rules apply to digital services sold to consumers and to goods sold through online marketplaces, so research these if they apply to you.</p>
<h2>Your personal tax</h2>
<p>As a director or shareholder, your own tax position also changes. Salary goes through payroll, and dividends may need to be reported through Self Assessment. Check whether you need to register for, or continue filing, a personal tax return.</p>
<h2>HMRC registration checklist</h2>
<ol>
<li>Find the company UTR when it arrives and store it securely.</li>
<li>Register for Corporation Tax once the company starts doing business.</li>
<li>Decide how you will pay yourself and whether PAYE registration is needed.</li>
<li>Track taxable turnover monthly against the current VAT threshold.</li>
<li>Research the VAT rules for digital or marketplace sales if relevant.</li>
<li>Check your personal Self Assessment obligations.</li>
<li>Set up HMRC online access for the company and store login details safely.</li>
</ol>
<p><strong>Try this:</strong> On gov.uk, find the pages on registering for Corporation Tax, registering as an employer and registering for VAT. Write a short note on what would trigger each registration for your business.</p>$h$));

  -- Module 4
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Banking, payments and separating finances', $t$Set up business banking and payment processing correctly, and keep your company's money clearly separate from your own.$t$, 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Why separating personal and business finances matters', $t$Learn how mixing funds can weaken liability protection and make tax and records harder.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Of all the habits a new company owner can build, keeping personal and business money apart is one of the most important. It sounds like basic bookkeeping, but it affects your legal protection, your tax position and your ability to understand your own business.</p>
<h2>Protecting limited liability</h2>
<p>Limited liability depends on the company being genuinely separate from you. If you pay personal bills from the business account, deposit business income into your personal account or move money back and forth without records, you blur that line. In the US, courts can "pierce the corporate veil" in some circumstances and hold owners personally liable, and mixing funds is one of the factors they consider. In the UK, taking company money without proper records can create an overdrawn director's loan account, tax charges and, if the company becomes insolvent, personal claims against you.</p>
<h2>Accurate tax and accounts</h2>
<p>Tax returns and accounts are built from your transactions. When every business payment runs through a business account, bookkeeping is largely a matter of categorising transactions. When payments are mixed, you have to reconstruct what happened from memory, and you risk claiming personal costs as business expenses or missing genuine ones. Either mistake can cause problems if the tax authority asks questions.</p>
<h2>Clear decision-making</h2>
<p>Separate accounts let you see what the business actually earns and spends, so you can judge pricing, marketing and hiring on real numbers. Lenders, investors and buyers will also want clean records if you ever borrow, raise money or sell.</p>
<h3>Common mixing mistakes</h3>
<ul>
<li>Using a personal card for business subscriptions "just this once".</li>
<li>Having marketplace or payment processor payouts sent to a personal account.</li>
<li>Taking money out of the company without recording whether it is salary, a distribution, a dividend or a loan.</li>
<li>Paying business costs in cash without keeping receipts.</li>
<li>Lending money to the company without documenting it.</li>
</ul>
<blockquote><p>How owner withdrawals and expenses are treated for tax depends on your entity and location. Rules vary and change, so confirm with your tax authority or an accountant.</p></blockquote>
<h2>Separation checklist</h2>
<ol>
<li>Open a business bank account in the company's legal name.</li>
<li>Route all business income and expenses through it.</li>
<li>Use a business card for business purchases only.</li>
<li>Record every transfer between you and the company with a clear description.</li>
<li>Keep digital copies of receipts and invoices.</li>
<li>If you pay a business cost personally by mistake, record it and reimburse it properly.</li>
</ol>
<p><strong>Try this:</strong> Review the last month of your personal and business transactions. Highlight every item that is in the wrong place and decide how you will fix the habit that caused it.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Opening a business bank account', $t$Prepare the documents banks ask for and choose the right type of account.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A business bank account is the foundation of separated finances. Opening one can take days or weeks, because banks must verify who owns and controls the company. Good preparation makes the process faster and reduces the chance of rejection.</p>
<h2>Types of provider</h2>
<h3>Traditional banks</h3>
<p>Established high street and national banks offer full-service accounts, lending and branch access. They may require more documentation, sometimes an in-person visit, and may be cautious about owners who live abroad.</p>
<h3>Digital banks and financial technology providers</h3>
<p>Online-first providers often offer quick sign-up, good software integrations and multi-currency features. Check exactly what you are getting. Some are licensed banks; others are payment or electronic money institutions, or partner with a bank behind the scenes. That affects whether your money is protected by a deposit scheme, such as FDIC insurance in the US or the FSCS in the UK, or is safeguarded in a different way. Read the provider's disclosures carefully.</p>
<h2>What banks usually ask for</h2>
<ul>
<li>Formation documents, such as filed articles of organization or the certificate of incorporation.</li>
<li>Your company number or EIN confirmation.</li>
<li>Ownership documents, such as an operating agreement or register of shareholders.</li>
<li>Identity documents and proof of address for owners, directors and controllers.</li>
<li>A description of your business, website, products and customers.</li>
<li>Expected transaction volumes and the countries you will deal with.</li>
</ul>
<p>Banks are required to understand the businesses they serve, so answer their questions clearly and consistently. If your website is unfinished or your business model is hard to understand, expect more questions.</p>
<h2>Choosing an account</h2>
<p>Compare monthly fees, transaction charges, foreign exchange costs, card availability, integration with your accounting software, multi-user access, customer support and the provider's terms for closing accounts. Look up current pricing and terms on each provider's official site.</p>
<blockquote><p>Account eligibility, deposit protection and fees vary by provider and country and change regularly. Check current terms directly with the provider and with the official deposit protection scheme.</p></blockquote>
<h2>Bank account checklist</h2>
<ol>
<li>Gather formation, tax ID and ownership documents in one folder.</li>
<li>Prepare a clear one-paragraph description of your business.</li>
<li>Make sure your website or profile shows real products or services.</li>
<li>Shortlist two or three providers that accept businesses like yours.</li>
<li>Check how deposits are protected or safeguarded.</li>
<li>Apply with consistent information on every form.</li>
<li>Once the account is open, connect it to your bookkeeping software.</li>
</ol>
<p><strong>Try this:</strong> Write the business description you would give a bank: what you sell, to whom, how customers pay and which countries you deal with. Keep it to five sentences and reuse it for payment providers.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Setting up payment processors and marketplaces', $t$Connect payment providers to your company correctly and avoid common account problems.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>For most online businesses, money arrives through a payment processor, a marketplace or a platform rather than directly into the bank. Setting these accounts up in the company's name, with accurate details, is essential for clean records and for avoiding frozen funds.</p>
<h2>How payment providers work</h2>
<p>A payment processor lets you accept cards and other payment methods. It collects funds from customers, deducts its fees and pays out to your bank account on a schedule. Because processors carry risk if customers dispute charges, they verify your business and monitor activity. Common models include:</p>
<ul>
<li><strong>Direct processor accounts</strong>, where your company is the merchant and is responsible for refunds, disputes and taxes.</li>
<li><strong>Merchant of record platforms</strong>, which sell to the customer on your behalf and typically handle sales tax or VAT collection. You receive payouts from the platform rather than from each customer.</li>
<li><strong>Marketplaces</strong>, where the marketplace controls the checkout and pays you, often after holding funds for a period.</li>
</ul>
<h2>Setting up correctly</h2>
<p>When you sign up, select a business or company account, not an individual one. Enter the company's exact legal name, registration number or tax ID and registered address. Owners and directors may need to verify their identity. Payouts should go to the company's business bank account. Mismatched names or numbers are a common cause of verification delays and paused payouts.</p>
<h2>Reserves, holds and disputes</h2>
<p>Processors can hold back part of your payouts as a reserve, delay payouts, or close accounts that breach their terms or show unusual risk. You can reduce this risk by:</p>
<ul>
<li>reading the provider's acceptable use policy and restricted business list before applying;</li>
<li>describing your products accurately and keeping your website consistent with that description;</li>
<li>publishing clear refund, delivery and contact information;</li>
<li>using a recognisable statement descriptor so customers know what the charge is;</li>
<li>responding to disputes quickly, with evidence;</li>
<li>telling the provider in advance about large or unusual changes in sales volume.</li>
</ul>
<blockquote><p>Fees, payout timing, reserve policies and supported countries differ between providers and change often. Check each provider's current terms and pricing pages before you rely on them.</p></blockquote>
<h2>Payment setup checklist</h2>
<ol>
<li>Confirm the provider supports your country, entity type and business model.</li>
<li>Open a business account using the company's legal details.</li>
<li>Connect payouts to the business bank account only.</li>
<li>Publish refund, terms and contact pages on your website.</li>
<li>Set a clear statement descriptor.</li>
<li>Download monthly payout and fee reports for your bookkeeping.</li>
</ol>
<p><strong>Try this:</strong> Choose one payment provider you might use. Read its restricted business list and its payout and dispute terms, then write down any risks for your business model and how you would reduce them.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Paying yourself and keeping clean records', $t$Understand how owners take money out of an LLC or Ltd and how to document it.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once money is flowing into the business account, you will want to pay yourself. How you do that depends on your entity and its tax treatment, and getting it wrong can create tax bills or undermine the separation you have worked to build. This lesson covers the common methods and the records that support them.</p>
<blockquote><p>General education, not tax advice. How owner payments are taxed depends on your entity, its tax classification and where you live, and the rules change. Confirm with irs.gov, gov.uk or a qualified accountant before choosing a method.</p></blockquote>
<h2>Paying yourself from a US LLC</h2>
<p>In a single-member LLC taxed as a disregarded entity, owners usually take <strong>owner draws</strong>: transfers from the business account to their personal account. A draw is not a business expense; the owner is generally taxed on the LLC's profit whether or not it is withdrawn. Multi-member LLCs taxed as partnerships make <strong>distributions</strong> according to the operating agreement. If an LLC elects corporate or S corporation treatment, owners who work in the business are typically paid through payroll, and different rules apply to distributions.</p>
<h2>Paying yourself from a UK Ltd</h2>
<p>A company's money belongs to the company, not to its directors. Directors usually take money in one or more of these ways:</p>
<ul>
<li><strong>Salary</strong> paid through payroll and reported to HMRC under PAYE.</li>
<li><strong>Dividends</strong> paid to shareholders, which can only come from available profits and should be properly declared and documented.</li>
<li><strong>Director's loans</strong>: money taken that is not salary, a dividend or an expense reimbursement is recorded in a director's loan account. An overdrawn loan account can have tax consequences.</li>
<li><strong>Expense reimbursements</strong> for genuine business costs you paid personally, supported by receipts.</li>
</ul>
<h2>Records that support every payment</h2>
<p>Each transfer to an owner should be explainable months later. Use descriptive payment references, keep supporting documents such as payslips, dividend paperwork and records of board decisions, and reconcile your books every month.</p>
<h2>Bookkeeping habits checklist</h2>
<ol>
<li>Choose bookkeeping software and connect your bank and payment accounts.</li>
<li>Categorise transactions at least monthly.</li>
<li>Store receipts and invoices digitally, named consistently.</li>
<li>Label every owner payment as a draw, distribution, salary, dividend, loan or reimbursement.</li>
<li>Reconcile bank, processor and marketplace balances each month.</li>
<li>Keep records for as long as the law requires; check official guidance for the period.</li>
<li>Review your figures with an accountant before the year end.</li>
</ol>
<p><strong>Try this:</strong> Write a one-paragraph owner pay policy for your business: which method you will use, how often you will pay yourself and what records you will keep. Ask an accountant to review it.</p>$h$));

  -- Module 5
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Staying compliant and putting it into practice', $t$Keep your company in good standing with a compliance calendar, handle changes properly, then test and apply what you have learned.$t$, 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Annual reports, confirmation statements and accounts', $t$Understand the recurring filings that keep an LLC or Ltd in good standing.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Forming a company is a one-time event; keeping it in good standing is a recurring job. Missed filings can lead to penalties, loss of good standing, frozen bank or payment accounts and, eventually, the company being dissolved or struck off the register. This lesson explains the main recurring obligations so you can build a reliable calendar.</p>
<blockquote><p>General education, not legal or tax advice. Filing requirements, fees and deadlines vary by state and country and change over time. Confirm them on your state's Secretary of State website, irs.gov or gov.uk, or with a qualified professional.</p></blockquote>
<h2>US LLC obligations</h2>
<h3>State reports and taxes</h3>
<p>Most states require a periodic report, often called an annual report or statement of information, that confirms or updates the LLC's address, registered agent and members or managers. Frequency, due dates and fees vary. Some states also charge an annual franchise tax or minimum tax regardless of profit.</p>
<h3>Federal and state tax filings</h3>
<p>Federal filings depend on the LLC's tax classification. A disregarded entity's income usually goes on the owner's return, a partnership files its own information return, and an LLC taxed as a corporation files a corporate return. Foreign-owned LLCs may have extra reporting. States may require their own returns, plus sales tax returns if you are registered.</p>
<h3>Agent and details</h3>
<p>Keep a registered agent in place at all times, and update the state whenever addresses, members or managers change.</p>
<h2>UK Ltd obligations</h2>
<h3>Confirmation statement</h3>
<p>At least once a year, a company files a confirmation statement with Companies House. It confirms that the registered information, such as officers, shareholders, PSCs and SIC code, is correct, and reports any changes that have not already been filed.</p>
<h3>Annual accounts</h3>
<p>Every company must prepare annual accounts and file them with Companies House, even if it has not traded. Smaller companies may qualify for simpler accounts, but the rules on what must be filed are being reformed, so check gov.uk for the current position.</p>
<h3>Company Tax Return</h3>
<p>Separately, the company files a Company Tax Return with HMRC and pays any Corporation Tax due. The deadlines for paying and for filing are different.</p>
<h3>Event-driven updates</h3>
<p>You must tell Companies House about changes such as new directors, new PSCs or a new registered office within set time limits.</p>
<h2>Building your compliance calendar</h2>
<ol>
<li>List every recurring filing for your entity and location.</li>
<li>Find out from the official site how each due date is set.</li>
<li>Add reminders well before each date.</li>
<li>Note who is responsible: you, your accountant or your agent.</li>
<li>Keep proof of each filing once it is complete.</li>
</ol>
<p><strong>Try this:</strong> Create a twelve-month calendar for your company listing every filing you have identified, with a reminder one month before each one.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Getting help, handling changes and closing properly', $t$Know when to use professionals, how to manage changes and how to close a company correctly.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your company will change over time. You may add a partner, move country, outgrow your structure or decide to stop trading. Handling these moments properly protects you, and knowing when to bring in professional help saves money in the long run.</p>
<h2>When to get professional help</h2>
<p>You can handle much of the routine administration yourself, but some situations justify paying an accountant, tax adviser or lawyer:</p>
<ul>
<li>choosing or changing tax classification, such as an S corporation election;</li>
<li>cross-border situations, including ownership from abroad or moving country;</li>
<li>bringing in co-owners or investors, or issuing new shares;</li>
<li>registering for sales tax or VAT in several places;</li>
<li>disputes with co-owners, customers or tax authorities;</li>
<li>any doubt about whether the company can pay its debts.</li>
</ul>
<p>When choosing a professional, look for relevant qualifications and regulation, experience with online businesses like yours, clear pricing and a written engagement letter that sets out what they will and will not do.</p>
<h2>Handling common changes</h2>
<p>Most changes need an official filing as well as an update to your own records. Examples include changing your registered agent or registered office, appointing or removing directors or managers, transferring ownership and changing the company name. In the US, if you start doing business in another state, check whether you must register there as a foreign LLC. Also update banks and payment providers so their records match the official register; mismatches can trigger account reviews.</p>
<h2>Closing a company properly</h2>
<p>Simply stopping filings is not a clean way to close a company. Fees and penalties can build up, and a company that is dissolved while it still holds assets or owes money can create problems for its owners. A proper closure usually involves:</p>
<ol>
<li>settling or arranging the company's debts and collecting what is owed;</li>
<li>filing final tax returns and closing tax registrations;</li>
<li>distributing any remaining assets according to the rules;</li>
<li>filing the dissolution or strike-off application with the registry;</li>
<li>closing bank, payment and platform accounts after the final transactions;</li>
<li>keeping records for the required period after closure.</li>
</ol>
<p>US states have their own dissolution filings. In the UK, a solvent company that meets the conditions can apply to be struck off, while a company that cannot pay its debts needs a formal insolvency process.</p>
<blockquote><p>Rules for changes and closures vary and change. Check the official guidance from your state, Companies House or HMRC, and take professional advice where money or liability is involved.</p></blockquote>
<h2>Change management checklist</h2>
<ul>
<li>Keep a list of every register, bank and platform that holds your company's details.</li>
<li>Update all of them whenever those details change.</li>
<li>Review your structure and professional support once a year.</li>
</ul>
<p><strong>Try this:</strong> List every organisation that holds your company's details, from the registry to your payment providers. This becomes your update list for any future change.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What is the main role of a registered agent for a US LLC?$t$, $t$A registered agent is officially designated to receive service of process and official state correspondence for the LLC at a physical address in the state of formation, then pass it on promptly.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$To receive legal papers and official notices on behalf of the LLC$t$, true, 0),
    (qq, $t$To prepare and file the LLC's federal tax return$t$, false, 1),
    (qq, $t$To act as the authorised signatory on the LLC's bank account$t$, false, 2),
    (qq, $t$To approve changes to the LLC's operating agreement$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Why is it important to keep personal and business finances separate?$t$, $t$Separation supports limited liability by showing the company is genuinely distinct from its owner, and it makes accurate bookkeeping, accounts and tax filings far easier.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$It supports limited liability and makes accurate records and tax filings possible$t$, true, 0),
    (qq, $t$It is only necessary once the business has employees$t$, false, 1),
    (qq, $t$It removes the need to keep receipts and invoices$t$, false, 2),
    (qq, $t$It guarantees the company will pay less tax$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Forming an LLC or limited company protects you from personal liability in every situation.$t$, $t$False. Limited liability generally does not cover your own wrongful acts or debts you personally guarantee, and it can be lost if you do not respect the separation between you and the company.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, false, 0),
    (qq, $t$False$t$, true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$By default, how does the IRS treat a single-member LLC for federal income tax?$t$, $t$A single-member LLC is a disregarded entity by default, so its income is generally reported by the owner. It can elect a different classification if it chooses and is eligible.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$As a disregarded entity whose income is generally reported by the owner$t$, true, 0),
    (qq, $t$As a corporation that must always file its own corporate return$t$, false, 1),
    (qq, $t$As a partnership$t$, false, 2),
    (qq, $t$As a tax-exempt organisation$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Your UK company has just been incorporated. Where do you register it for Corporation Tax?$t$, $t$Companies House creates the company and keeps the public register, but tax registrations, including Corporation Tax, are handled by HMRC.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$HMRC$t$, true, 0),
    (qq, $t$Companies House$t$, false, 1),
    (qq, $t$The Intellectual Property Office$t$, false, 2),
    (qq, $t$Your registered office provider$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of these are typically needed to register a UK private limited company? Select all that apply.$t$, $t$Registration requires a registered office in the correct UK jurisdiction, at least one director and details of people with significant control. A VAT number and a bank account are not needed to incorporate.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$A registered office address in the correct UK jurisdiction$t$, true, 0),
    (qq, $t$At least one director$t$, true, 1),
    (qq, $t$Details of people with significant control$t$, true, 2),
    (qq, $t$A VAT registration number$t$, false, 3),
    (qq, $t$An open business bank account$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What is the purpose of a UK confirmation statement?$t$, $t$The confirmation statement confirms that the information Companies House holds about the company, such as officers, shareholders and PSCs, is correct and up to date. Profits and tax are reported separately.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$To confirm the company's registered information is correct and up to date$t$, true, 0),
    (qq, $t$To report the company's profit and pay Corporation Tax$t$, false, 1),
    (qq, $t$To register the company for VAT$t$, false, 2),
    (qq, $t$To renew the company's name each year$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which steps help reduce the risk of payment processor verification delays or held payouts? Select all that apply.$t$, $t$Processors verify businesses and monitor risk. Using exact legal details, paying out to the business account and publishing clear refund and contact information all help. Vague descriptions and personal accounts increase the risk of problems.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Using the company's exact legal name and tax ID when signing up$t$, true, 0),
    (qq, $t$Sending payouts to the company's business bank account$t$, true, 1),
    (qq, $t$Publishing clear refund, delivery and contact information$t$, true, 2),
    (qq, $t$Describing your products vaguely so you can sell anything later$t$, false, 3),
    (qq, $t$Signing up as an individual to save time$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$If you live and operate in one US state but form your LLC in another, you may also need to register the LLC as a foreign LLC in your home state.$t$, $t$True. If the LLC is transacting business in your home state, that state may require foreign registration, which brings its own fees and reports. Check your state's official rules.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, true, 0),
    (qq, $t$False$t$, false, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What is an LLC operating agreement?$t$, $t$The operating agreement is the LLC's internal rulebook, covering ownership, management, distributions and what happens when members join or leave. The formation document filed with the state is a separate document.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The internal document setting out how the LLC is owned and run$t$, true, 0),
    (qq, $t$The form filed with the state to create the LLC$t$, false, 1),
    (qq, $t$The IRS notice confirming the LLC's EIN$t$, false, 2),
    (qq, $t$The contract between the LLC and its registered agent$t$, false, 3);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$This quiz covers business structures, forming a US LLC, forming a UK company, banking and payments, and ongoing compliance. It tests concepts, not specific fees or deadlines. You need 70% to pass, and you will see an explanation for each answer after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'Build your company formation and compliance plan', $h$<p>In this assignment you will turn what you have learned into a practical plan for your own business, or for a realistic example business if you are not ready to form a company yet. The goal is a document you could hand to an accountant or adviser and use to run your company's first year.</p>
<blockquote><p>This is a planning exercise, not legal or tax advice. Use official sources such as irs.gov, gov.uk and your state's Secretary of State website, and note anything you would confirm with a qualified professional.</p></blockquote>
<h2>What to submit</h2>
<ol>
<li><strong>Structure decision (around 200 words).</strong> State the entity type and jurisdiction you have chosen and explain why, referring to liability, tax, administration and where you live and operate. Mention at least one alternative you considered and why you rejected it.</li>
<li><strong>Formation steps.</strong> List each step needed to form your company, in order, including the name check, registered agent or registered office, members or officers, the formation filing and the EIN or HMRC registrations. For each step, note the official source you checked and the date you checked it.</li>
<li><strong>Banking and payments setup.</strong> Describe the type of bank account and payment provider you would use, the documents you will need, how you will keep personal and business finances separate and how you will pay yourself.</li>
<li><strong>Twelve-month compliance calendar.</strong> List every recurring filing and registration you identified, how its due date is set, who is responsible and the reminder you will use. Do not guess dates; where a date depends on your formation date or year end, explain how it is calculated and where that is published.</li>
<li><strong>Questions for a professional.</strong> List at least three specific questions you would take to an accountant or lawyer.</li>
</ol>
<h2>Format</h2>
<p>Submit your plan as text, as an uploaded document such as a PDF or Word file, or as a link to a shared document. Do not include tax identification numbers, full home addresses, bank details or copies of identity documents.</p>
<h2>How it will be assessed</h2>
<p>Your submission will be assessed against the rubric: a well-reasoned structure decision, accurate and sourced formation steps, a realistic banking and separation plan, and a complete compliance calendar with clear next steps.</p>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion','Structure decision','description','Chooses an entity and jurisdiction and justifies the choice using liability, tax, administration and location, including an alternative that was considered.','points',25),
        jsonb_build_object('id','c2','criterion','Formation steps and sources','description','Lists formation and registration steps in a logical order, each supported by an official source and the date it was checked.','points',30),
        jsonb_build_object('id','c3','criterion','Banking and financial separation','description','Describes a realistic banking and payment setup, the documents required, the owner pay method and how finances will stay separate.','points',20),
        jsonb_build_object('id','c4','criterion','Compliance calendar and next steps','description','Covers recurring filings with how due dates are set, responsibilities and reminders, plus specific questions for a professional.','points',25)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', $t$Create a formation, banking and compliance plan for your own company.$t$, 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Put the course into practice by creating a formation and compliance plan you can actually use, built on official sources and ready to discuss with a professional.$t$));
end $$;
