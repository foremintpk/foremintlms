-- Foremint Academy course content: Shopify Store Launch
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'shopify-store-launch';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'Shopify Store Launch',
    short_description = $t$Set up, design and launch a Shopify store step by step. Configure your store settings and domain, customise a theme, add products and collections, set up payments, shipping and taxes, choose apps carefully, run a full pre-launch check and start your first marketing with confidence.$t$,
    description = $h$<p>Shopify makes it possible to open a professional online store without writing code, but a store that customers trust takes more than picking a theme. This course walks you through every stage of setting up and launching a Shopify store, in the order you will actually do it, with practical checklists at each step.</p>
<h2>What you will learn</h2>
<p>You start by learning how the Shopify admin is organised, how to compare plans, which store settings to complete first, how to secure your account and how to connect a custom domain. You then choose a theme, customise it with sections and blocks, build the pages and menus customers expect, and make your storefront fast, mobile-friendly and accessible.</p>
<p>In the products module you work through every field of the product form, set up variants and inventory, organise your catalogue into manual and automated collections, and write product pages that help customers decide and help search engines understand. Next you configure payments and checkout, shipping profiles, zones and rates, and tax settings, and learn a disciplined way to choose and manage apps. Finally, you run a complete pre-launch check with test orders, go live and start your first marketing with search visibility, email and sustainable campaigns.</p>
<h2>How the course works</h2>
<ul>
<li>Eighteen practical lessons that follow the real setup order, each ending with a "Try this" task you complete in your own store.</li>
<li>Step-by-step checklists you can reuse for future stores or for clients.</li>
<li>A course quiz to confirm your understanding of every module.</li>
<li>A practical assignment: a launch-readiness audit of your own Shopify store.</li>
</ul>
<h2>Before you start</h2>
<p>You can follow along using a Shopify free trial if one is available to you. Shopify updates its admin, plans and features regularly, so the lessons describe settings by what they do rather than relying on exact menu positions or prices. Where details such as fees, plan features or availability matter, you are shown where to check the current information on Shopify's official pricing pages and in the Shopify Help Center.</p>
<p>If you are new to running an online business, the E-commerce Business Essentials course covers niche selection, pricing, margins, fulfilment and customer service in more depth and pairs well with this one.</p>$h$,
    learning_outcomes = array[
      'Set up a Shopify store with accurate store details, secure staff access and a custom domain',
      'Choose and customise a theme using sections, blocks and templates',
      'Add products with variants, inventory and search-friendly content',
      'Organise products into manual and automated collections',
      'Configure payments, checkout, shipping profiles and tax settings correctly',
      'Evaluate, install and manage apps safely',
      'Complete a pre-launch checklist with test orders before going live',
      'Plan and run your first marketing activities after launch'
    ],
    requirements = array[
      'A computer with a modern web browser',
      'An email address and products or a product idea ready to sell',
      'Basic familiarity with online shopping and web forms',
      'No coding experience is required'
    ],
    target_audience = array[
      'First-time store owners launching on Shopify',
      'Makers, creators and small businesses moving their sales online',
      'Freelancers setting up Shopify stores for clients',
      'Marketplace sellers adding their own branded store'
    ],
    tags = array['shopify','ecommerce','online-store','store-setup','themes','shipping','store-launch'],
    level = 'beginner',
    estimated_duration_minutes = 258,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = 'Shopify Store Launch Course | Foremint Academy',
    seo_description = 'Launch your Shopify store step by step: settings, domain, theme, products, collections, payments, shipping, taxes, apps and a pre-launch checklist.'
  where id = c;

  -- Module 1
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Setting up your Shopify store', 'Understand how Shopify is organised, then configure your plan, store details, security and domain.', 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'How a Shopify store is organised', 'A tour of the Shopify admin, sales channels, themes and apps so you know where everything lives.', 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Shopify is a hosted commerce platform. You pay a subscription, and Shopify runs the software, hosting and checkout while you manage products, orders and design through a web dashboard called the Shopify admin. Before you change any settings, it helps to understand how the pieces fit together. This lesson gives you that map.</p>
<h2>The main areas of the Shopify admin</h2>
<p>The admin's main menu groups your work into a few areas. Names and positions change from time to time, but the core ideas stay the same:</p>
<ul>
<li><strong>Home:</strong> a summary of recent activity and suggested setup tasks.</li>
<li><strong>Orders:</strong> every order, with its payment status and fulfilment status.</li>
<li><strong>Products:</strong> your catalogue, inventory, collections and related tools.</li>
<li><strong>Customers:</strong> customer records, order history and marketing consent.</li>
<li><strong>Marketing and Discounts:</strong> campaigns, automations and discount codes.</li>
<li><strong>Analytics:</strong> reports and dashboards about sales, traffic and customers.</li>
<li><strong>Sales channels:</strong> the places you sell, starting with the Online Store and optionally adding others such as social platforms, marketplaces or in-person selling.</li>
<li><strong>Apps:</strong> extra features you install from the Shopify App Store.</li>
<li><strong>Settings:</strong> store-wide configuration, including payments, checkout, shipping, taxes, domains, users, notifications and policies.</li>
</ul>
<p>If you cannot find a setting where a lesson describes it, use the search bar at the top of the admin. It finds settings, products, orders and help articles.</p>
<h2>Key ideas to understand early</h2>
<h3>The Online Store is a sales channel</h3>
<p>Your website is technically one sales channel among several. A product must be active and available on the Online Store channel to appear on your site. When a product is missing from your storefront, its status and channel availability are the first things to check.</p>
<h3>Themes control design, settings control behaviour</h3>
<p>Your theme decides how the store looks: layouts, colours, fonts and page sections. Settings decide how the business runs: payment methods, shipping rates, tax rules and customer notifications. If something looks wrong, start in the theme editor. If something calculates wrongly, start in Settings.</p>
<h3>Apps add features</h3>
<p>Shopify covers the essentials. Apps add specialised features such as subscriptions, advanced shipping rules or loyalty programmes. Each app may add cost and complexity, so install apps for a clear purpose only, as covered in Module 4.</p>
<h3>Orientation checklist</h3>
<ul>
<li>Locate Orders, Products, Customers and Analytics in the admin.</li>
<li>Open Settings and scan its categories without changing anything yet.</li>
<li>Find the Online Store channel and its themes area.</li>
<li>Try the admin search bar by searching for "shipping".</li>
<li>Bookmark the Shopify Help Center at help.shopify.com, the official source for current instructions.</li>
</ul>
<h3>Try this</h3>
<p>Spend ten minutes clicking through every main section of the admin. For each one, write a single sentence in your notes describing what it is for. You will refer back to this map throughout the course.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing a plan and starting your store', 'How Shopify plans differ, what the trial lets you do and what to decide before you sign up.', 'article', 1, 10, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Shopify offers several subscription plans, and the right one depends on your stage, sales volume and the features you need. Plan names, prices, trial terms and included features change regularly, so this lesson explains how to compare plans rather than listing current figures. Always check Shopify's official pricing page before you decide.</p>
<h2>What typically differs between plans</h2>
<ul>
<li><strong>Subscription price:</strong> paying annually is often cheaper per month than paying monthly.</li>
<li><strong>Card processing rates:</strong> rates for payments through Shopify Payments usually vary by plan.</li>
<li><strong>Third-party transaction fees:</strong> if you use an external payment provider instead of Shopify Payments, an additional fee may apply depending on your plan.</li>
<li><strong>Staff accounts:</strong> the number of people who can log in with their own accounts.</li>
<li><strong>Reporting and advanced features:</strong> such as more detailed reports, additional inventory locations, international selling tools and shipping discounts.</li>
</ul>
<p>Beginners rarely need the most advanced plan. A sensible approach is to start on the plan that covers your essential features and review it once you have real sales data. Moving to a different plan later is straightforward.</p>
<h2>Starting your store</h2>
<p>When you sign up, Shopify asks a few questions about your business and creates a store with an address ending in <code>myshopify.com</code>. This address stays linked to your store even after you connect your own domain, and it is used to reach your admin, so choose your store name thoughtfully. You can change the store's display name later in Settings.</p>
<p>While you are on a trial, or until you choose a paid plan, your online store is protected by a password page, so the public cannot place orders yet. That gives you time to set up products, design and settings safely. You will remove the password as part of launch in Module 5, which requires an active paid plan.</p>
<h2>Before you sign up</h2>
<p>A little preparation makes the first sessions in your store far more productive, and it prevents decisions you would later need to undo.</p>
<h3>Decisions checklist</h3>
<ol>
<li>Check in the Help Center whether Shopify Payments is available in your country, or identify an alternative payment provider.</li>
<li>Decide on your store name and check that a matching domain is available.</li>
<li>Estimate your monthly sales so you can compare plan costs, including processing rates.</li>
<li>List the features you need at launch and those that can wait.</li>
<li>Prepare a business email address to use for the account.</li>
</ol>
<h3>Try this</h3>
<p>Open the official pricing page and build a short comparison in a spreadsheet. For two plans, record the subscription cost, the card processing rate and any third-party transaction fee. Using your expected monthly sales, estimate the total monthly cost of each and note which plan you will start on and when you will review that choice.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Store details, staff accounts and security', 'Complete your core store settings and protect your account before you add anything else.', 'article', 2, 11, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your store's basic settings feed into invoices, emails, tax calculations and checkout. Getting them right early saves confusing fixes later. This lesson covers the settings to complete in your first session and the security steps that protect your business.</p>
<h2>Core store details</h2>
<p>In the Shopify admin, open Settings and find the general store details area. Review and complete:</p>
<ul>
<li><strong>Store name and contact details:</strong> the name customers see and the email address Shopify uses to contact you. Customer notifications use a sender email, which you can review in the notification settings.</li>
<li><strong>Billing information:</strong> the legal business name and address used on your Shopify invoices.</li>
<li><strong>Store currency:</strong> the currency you price products in and see reports in. Changing it after you have taken orders can be restricted and can complicate reporting, so choose carefully and check Shopify's current guidance before changing it.</li>
<li><strong>Time zone and units:</strong> used for order dates, reports and product weights.</li>
<li><strong>Order ID format:</strong> optional prefixes or suffixes for your order numbers.</li>
</ul>
<h2>Staff accounts and permissions</h2>
<p>If anyone else will help in your store, give them their own staff account rather than sharing your login. The users area in Settings lets you invite staff and choose permissions for each person, such as access to orders but not to payment settings or financial reports. The number of staff accounts available depends on your plan.</p>
<p>Your own account is the store owner account. It has full access, including billing and the ability to transfer or close the store. Keep it for yourself.</p>
<h3>Collaborators</h3>
<p>Developers and agencies usually request collaborator access instead of a staff account. Collaborator requests can be limited to specific permissions, and you can require a request code before anyone can ask for access. Review collaborator access regularly and remove it when the work ends.</p>
<h2>Securing your account</h2>
<p>A compromised admin account can expose customer data and redirect your payouts. Turn on two-step authentication in your account security settings, and ask every staff member to do the same. Use a password manager and a unique, strong password.</p>
<h3>First-session checklist</h3>
<ol>
<li>Complete the store name, contact email and billing address.</li>
<li>Confirm store currency, time zone and weight units.</li>
<li>Turn on two-step authentication for your account.</li>
<li>Invite staff with only the permissions they need.</li>
<li>Decide whether collaborators need a request code.</li>
<li>Note your <code>myshopify.com</code> address and admin login link somewhere safe.</li>
</ol>
<h3>Try this</h3>
<p>Complete the first-session checklist in your store. If you work with others, write a short permissions plan listing each person, the areas they need and the areas they should not be able to access, then set up their accounts to match.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Connecting a custom domain', 'Buy or connect your own domain, set it as primary and confirm the secure connection.', 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your custom domain, such as <code>yourbrand.com</code>, is how customers find and remember your store, and it looks more trustworthy than the default <code>myshopify.com</code> address. Shopify lets you either buy a domain directly or connect one you already own from another provider.</p>
<h2>Option 1: buy a domain through Shopify</h2>
<p>In the Shopify admin, open Settings, go to the domains area and choose to buy a new domain. Shopify sets up the connection automatically, and renewal is handled through your Shopify billing. This is the simplest route for beginners. Check the price and renewal terms shown at the time of purchase.</p>
<h2>Option 2: connect a domain you already own</h2>
<p>If you bought a domain from a third-party registrar, you can keep it there and point it to Shopify. The general process is:</p>
<ol>
<li>In the domains settings, choose to connect an existing domain.</li>
<li>Enter your domain. Shopify may offer to connect it automatically if your registrar supports this.</li>
<li>Otherwise, sign in to your registrar's DNS settings and update the records Shopify specifies, typically an A record for the root domain and a CNAME record for the <code>www</code> subdomain.</li>
<li>Return to Shopify and verify the connection. DNS changes can take some time to take effect.</li>
</ol>
<p>Always copy the exact record values from Shopify's current instructions in the admin or the Help Center, because they can change. Do not delete unrelated records, such as those used by your email provider, or your email may stop working.</p>
<h3>Choosing a good domain</h3>
<ul>
<li>Short, easy to spell and easy to say aloud.</li>
<li>Matches your store name, or comes very close to it.</li>
<li>Avoids hyphens and numbers that people may forget.</li>
<li>Does not use another company's trademark.</li>
</ul>
<h2>After the domain connects</h2>
<p>Set your custom domain as the primary domain, so visitors who use your other addresses are redirected to it. Shopify provides SSL certificates for connected domains, so your store loads securely over HTTPS; check the domain's status in the admin. While your store is still password protected, visitors to your domain will see the password page.</p>
<h3>Domain checklist</h3>
<ul>
<li>Domain bought or connected and showing as connected.</li>
<li>Primary domain set, including your preferred www or non-www version.</li>
<li>SSL certificate active for the domain.</li>
<li>Email records at your registrar left untouched.</li>
<li>Renewal date and auto-renew setting noted.</li>
</ul>
<h3>Try this</h3>
<p>Connect or buy your domain, set it as primary, then visit it on your phone and your computer. Confirm the address bar shows a secure connection and that both the www and non-www versions lead to the same place.</p>$h$));

  -- Module 2
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Themes and store design', 'Pick a theme and shape it into a clear, trustworthy and mobile-friendly storefront.', 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing the right theme', 'Evaluate free and paid themes against your products, content and budget.', 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your theme is the design framework for your online store. It controls page layouts, styles and the sections you can add. Because changing theme later means redoing customisation work, it pays to choose thoughtfully. The good news is that you can preview and try themes in your own store before publishing them.</p>
<h2>Where themes come from</h2>
<p>The official Shopify Theme Store, at themes.shopify.com, lists free themes made by Shopify and paid themes from independent designers. Themes in the Theme Store are reviewed against Shopify's requirements and receive updates through the admin. Themes bought elsewhere may not meet the same standards, so beginners are usually better off staying within the Theme Store.</p>
<p>Modern Shopify themes let you add, remove and reorder sections on most pages without code. When comparing themes, confirm this flexibility in the theme's documentation and demo store.</p>
<h2>How to evaluate a theme</h2>
<ol>
<li><strong>Fit with your catalogue.</strong> A store with a few hero products needs different layouts from one with hundreds of items and filters. Look for demo stores similar to yours in size.</li>
<li><strong>Features you need.</strong> Check for built-in features such as product filtering, quick view, size charts, colour swatches, large drop-down menus or support for several languages, so that you need fewer apps.</li>
<li><strong>Mobile experience.</strong> Open the demo on your phone and browse as a customer would. Many shoppers use mobile devices, so this matters at least as much as the desktop look.</li>
<li><strong>Speed and simplicity.</strong> Heavy animation and large media can slow pages down. A simpler design is often easier to shop.</li>
<li><strong>Support and updates.</strong> For paid themes, check the developer's support policy, documentation and update history.</li>
</ol>
<h2>Free or paid?</h2>
<p>Free Shopify themes are well built and a solid choice for most first stores. Paid themes may offer more specialised layouts or features. Pay for a theme when it solves a specific need for your products, not because it looks impressive in a demo filled with professional photography you do not yet have.</p>
<h3>Theme selection steps</h3>
<ol>
<li>Shortlist three themes that fit your catalogue size and style.</li>
<li>Browse each demo on mobile and desktop.</li>
<li>Add your favourite to your theme library and preview it with your own products and logo.</li>
<li>Check that every feature on your list is built in.</li>
<li>Keep the theme unpublished until you are happy with it, or until launch.</li>
</ol>
<h3>Try this</h3>
<p>Write down the five features your storefront must have. Compare three themes against that list, then add the best match to your theme library and preview it with at least one of your own products.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Customising your theme with sections and blocks', 'Use the theme editor to build your home page and templates without touching code.', 'article', 1, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>The theme editor is where you shape your storefront. You do not need to write code for most changes: you work with sections, blocks and theme settings in a visual editor that shows a live preview. This lesson explains those building blocks and a safe way to work with them.</p>
<h2>The building blocks</h2>
<ul>
<li><strong>Templates</strong> define the layout for a type of page, such as the home page, product pages, collection pages or standard pages. You can create alternative templates, for example a different product layout for a special range, and assign them to specific items.</li>
<li><strong>Sections</strong> are the large horizontal parts of a page, such as an image banner, featured collection, rich text area or newsletter sign-up. You can add, hide, reorder and remove them.</li>
<li><strong>Blocks</strong> are the smaller elements inside a section, such as a heading, button, image or product detail. Each section supports particular block types.</li>
<li><strong>Theme settings</strong> control store-wide styles such as colours, typography, logo, buttons and social media links.</li>
</ul>
<h2>Working safely</h2>
<p>In the Shopify admin, open the Online Store channel and go to your themes. Before major changes, duplicate your theme so you have a backup copy. Edit the unpublished copy, preview it and publish it only when you are satisfied. Once you have launched, this habit protects your live store from half-finished work.</p>
<p>Use the page selector in the editor to switch between templates, and the device toggle to check mobile and desktop views as you go.</p>
<h2>Building a clear home page</h2>
<p>Your home page should quickly answer three questions: what do you sell, who is it for and why should the visitor trust you? A simple, effective structure is:</p>
<ol>
<li>A banner with a clear headline, a short supporting line and one call-to-action button.</li>
<li>A featured collection or best-sellers section.</li>
<li>A short section explaining what makes your products different.</li>
<li>Trust information, such as shipping and returns highlights.</li>
<li>Genuine customer reviews, once you have them.</li>
<li>An email sign-up section.</li>
</ol>
<h3>Theme customisation checklist</h3>
<ul>
<li>Logo uploaded and sized to work on mobile.</li>
<li>Brand colours and fonts applied consistently in theme settings.</li>
<li>Home page built with a clear headline and call to action.</li>
<li>Product and collection templates reviewed with real products.</li>
<li>Header and footer content checked, including social links.</li>
<li>A backup copy of the theme saved before major edits.</li>
</ul>
<h3>Try this</h3>
<p>Duplicate your theme, then build your home page using the six-part structure above. Preview it in the mobile view and adjust anything a first-time visitor could not understand within a quick scroll.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Pages, navigation and essential store content', 'Create the pages and policies customers look for and organise menus so everything is easy to reach.', 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Beyond products, customers look for information that helps them decide whether to trust you. A small set of well-written pages and clear menus answers most questions before they turn into support emails.</p>
<h2>Essential pages</h2>
<ul>
<li><strong>About:</strong> who you are, why the store exists and what makes your products different. Keep it honest and specific.</li>
<li><strong>Contact:</strong> a contact form plus your support email, hours and typical response time. Most themes include a contact template you can assign to a page.</li>
<li><strong>FAQ:</strong> concise answers about shipping, returns, sizing, care and payments.</li>
<li><strong>Shipping information:</strong> where you ship, how long it takes and how costs work.</li>
<li><strong>Size or product guides:</strong> if they are relevant to what you sell.</li>
</ul>
<p>Standard pages are created in the pages area of the Shopify admin, which you can find under the Online Store channel or through the admin search bar.</p>
<h2>Store policies</h2>
<p>Shopify provides a dedicated policies area in Settings for your refund policy, privacy policy, terms of service, shipping policy and contact information. Policies added there can be linked from your checkout. Shopify offers templates, but you are responsible for the content: edit them to describe how your store actually works and to meet the laws where you sell. Consider having a professional review them.</p>
<h2>Navigation menus</h2>
<p>Menus are managed in the admin's navigation or menus area. Most themes use a main menu in the header and a footer menu. Good navigation follows a few principles:</p>
<ul>
<li>Keep the main menu short and use words customers would use, such as "Gifts" or "New in".</li>
<li>Link to collections rather than individual products in the main menu.</li>
<li>Use the footer for supporting pages: FAQ, shipping, returns, contact and policies.</li>
<li>Use nested menu items for drop-downs only when you have enough collections to need them.</li>
</ul>
<h3>Content setup steps</h3>
<ol>
<li>Write and publish your About, Contact and FAQ pages.</li>
<li>Complete each policy in the policies settings, adapting the templates.</li>
<li>Build the main menu around your key collections.</li>
<li>Build the footer menu with support pages and policies.</li>
<li>Click every menu link on mobile and desktop to check that it works.</li>
<li>Send a test message through your contact form and confirm it reaches your inbox.</li>
</ol>
<h3>Try this</h3>
<p>List the ten questions you expect customers to ask before buying. Make sure each one is answered on a product page, the FAQ or a policy, and that a customer could find each answer within two clicks of the home page.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Designing for mobile, speed and accessibility', 'Make your storefront fast, readable and usable for every visitor on every device.', 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A beautiful desktop design means little if mobile visitors struggle to read text, tap buttons or wait for pages to load. Designing for mobile, speed and accessibility improves the experience for everyone and supports your search visibility too.</p>
<h2>Mobile first</h2>
<p>Many visitors will browse your store on a phone. Review every key page in the theme editor's mobile view and on a real device:</p>
<ul>
<li>Is the headline readable without zooming?</li>
<li>Are buttons large enough to tap and clearly labelled?</li>
<li>Is the add-to-cart button easy to find on product pages?</li>
<li>Do images crop well, without cutting off the product?</li>
<li>Can visitors open the menu and search easily?</li>
</ul>
<h2>Speed</h2>
<p>Shopify hosts your store on fast infrastructure, but your choices still affect load times. The biggest factors you control are:</p>
<ul>
<li><strong>Images:</strong> upload high-quality images at sensible dimensions rather than very large original files. Shopify serves optimised versions, but oversized uploads and many images per page still add weight.</li>
<li><strong>Video and sliders:</strong> autoplaying video and multi-slide carousels add load time and are often skipped by visitors. Use them only when they earn their place.</li>
<li><strong>Apps:</strong> some apps add scripts to every page. Remove apps you no longer use and check that their storefront elements are gone too.</li>
<li><strong>Sections:</strong> fewer, purposeful sections load faster and are easier to scan.</li>
</ul>
<p>Your admin may include a store speed or web performance report, and free tools such as Google PageSpeed Insights can highlight specific issues on individual pages.</p>
<h2>Accessibility basics</h2>
<p>An accessible store can be used by people with visual, motor, hearing or cognitive impairments, and accessibility is a legal requirement for some businesses in some places. Start with these essentials:</p>
<ul>
<li>Add descriptive alt text to product and content images.</li>
<li>Keep strong colour contrast between text and backgrounds.</li>
<li>Avoid putting important text inside images.</li>
<li>Use clear link and button labels, such as "View all candles" instead of "Click here".</li>
<li>Check that the store can be navigated using only a keyboard.</li>
</ul>
<h3>Design quality checklist</h3>
<ol>
<li>Review the home, collection, product and cart pages on a real phone.</li>
<li>Resize large images before upload where needed.</li>
<li>Remove unused sections and apps.</li>
<li>Run a speed test on your home page and a product page.</li>
<li>Add alt text to every product image.</li>
<li>Check colour contrast and keyboard navigation.</li>
</ol>
<h3>Try this</h3>
<p>Ask someone who has not seen your store to find a specific product and add it to the cart on their phone while you watch without helping. Write down every moment they hesitate, and fix the top three issues.</p>$h$));

  -- Module 3
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Products and collections', 'Add products with complete information and organise them so customers can find what they need.', 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Adding your first product', 'Walk through every part of the product form and what each field does.', 'article', 0, 13, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Products are the heart of your store, and the product form in the Shopify admin contains much more than a title and a price. Understanding each field now means your catalogue will be accurate for customers, shipping, tax and reporting from day one.</p>
<h2>The product form, section by section</h2>
<p>In the Shopify admin, open Products and choose to add a product. You will see these main areas:</p>
<ul>
<li><strong>Title and description:</strong> the product name and the main selling copy. The last lesson in this module covers writing them well.</li>
<li><strong>Media:</strong> photos, videos or 3D models. Use consistent backgrounds and sizes, and show the product from several angles, in use and at scale.</li>
<li><strong>Category:</strong> a standardised product category from Shopify's product taxonomy, which can help with tax calculation and with listing on other sales channels.</li>
<li><strong>Pricing:</strong> the price, an optional compare-at price and the cost per item. Shopify uses cost per item to show your profit and margin. Use compare-at prices only for genuine previous prices, because misleading reference prices can breach consumer law.</li>
<li><strong>Tax:</strong> whether tax is charged on this product.</li>
<li><strong>Inventory:</strong> whether Shopify tracks quantity, the SKU and barcode, stock at each location and whether to keep selling when the item is out of stock.</li>
<li><strong>Shipping:</strong> whether it is a physical product, its weight and, for international orders, customs information such as country of origin and HS code.</li>
<li><strong>Variants:</strong> options such as size or colour, covered in the next lesson.</li>
<li><strong>Search engine listing:</strong> the page title, meta description and URL handle.</li>
</ul>
<h2>Status, channels and organisation</h2>
<p>On the same page you also set:</p>
<ul>
<li><strong>Status:</strong> active products can be sold, while draft products stay hidden while you work on them.</li>
<li><strong>Sales channels:</strong> where the product is available. Make sure the Online Store is included.</li>
<li><strong>Product organisation:</strong> type, vendor, collections and tags. These fields power automated collections and filters, so use them consistently.</li>
</ul>
<h3>Product setup steps</h3>
<ol>
<li>Create the product and leave it as a draft.</li>
<li>Add the title, description and at least three high-quality images.</li>
<li>Enter the price, cost per item and tax setting.</li>
<li>Add the SKU, inventory quantity and shipping weight.</li>
<li>Set product type, vendor and tags using a consistent naming system.</li>
<li>Preview the product page on mobile, then set the status to active when it is ready.</li>
</ol>
<h3>Try this</h3>
<p>Add your three most important products in full, including cost per item and accurate weights. Write down the naming rules you used for product types and tags so every future product follows the same pattern.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Variants, inventory and product organisation', 'Set up options and variants correctly and keep inventory accurate across your catalogue.', 'article', 1, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>When a product comes in different sizes, colours or materials, you create options and variants rather than separate products. Getting variants and inventory right keeps your store tidy, makes filters work and stops you from selling stock you do not have.</p>
<h2>Options and variants</h2>
<p>An <strong>option</strong> is a choice the customer makes, such as size or colour. A <strong>variant</strong> is each specific combination, such as "Medium / Blue". Shopify creates variants from your options, and each variant can have its own price, SKU, barcode, weight, inventory and image.</p>
<ul>
<li>Use options only for genuine customer choices that belong on one product page.</li>
<li>Keep option names and values consistent across products, for example always "Size" with the values "S", "M" and "L", so storefront filters group them properly.</li>
<li>Assign an image to each colour variant so the photo changes when a customer selects it.</li>
<li>Shopify limits the number of options and variants per product. If you approach those limits, check the current figures in the Help Center and consider splitting the range into separate products grouped in a collection.</li>
</ul>
<h2>Inventory tracking</h2>
<p>When inventory tracking is on, Shopify reduces stock as orders come in and can stop selling a variant when it reaches zero. For each variant, decide on:</p>
<ul>
<li><strong>Track quantity:</strong> usually on for physical stock you hold.</li>
<li><strong>Continue selling when out of stock:</strong> only if you deliberately accept backorders and tell customers the expected delivery time.</li>
<li><strong>Locations:</strong> where stock is held, such as your home, a shop or a fulfilment partner. Locations affect which stock can fulfil an order and where it ships from.</li>
</ul>
<p>When stock arrives or you correct a count, record the change in the inventory area so your history stays accurate. Shopify also includes tools for recording incoming stock and transfers between locations; check the Help Center for how they work on your plan.</p>
<h2>Organising your catalogue</h2>
<p>Product type, vendor and tags are quiet but powerful fields. They drive automated collections, filters and reports. Agree on a short, consistent list of product types and a tagging convention, and avoid near-duplicates such as "T-shirt", "Tshirt" and "Tee". Tags work well for attributes like material, occasion or collection membership.</p>
<h3>Variant and inventory checklist</h3>
<ol>
<li>Each variant has a unique SKU and the correct price.</li>
<li>Weights are entered for every physical variant.</li>
<li>Inventory tracking is on, with accurate starting quantities.</li>
<li>Selling when out of stock is off unless backorders are intended.</li>
<li>Colour variants have matching images.</li>
<li>Product types and tags follow your naming rules.</li>
</ol>
<h3>Try this</h3>
<p>Choose a product with options and set up all its variants, including SKUs, weights, quantities and images. Then select each variant on the storefront and add it to your cart to confirm that prices and images update correctly.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Building manual and automated collections', 'Group products into collections that power navigation, merchandising and promotions.', 'article', 2, 11, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Collections group products so customers can browse them together, such as "New arrivals", "Gifts" or "Kitchen". Collections power your menus, home page sections, filters and many promotions, so a clear structure makes the whole store easier both to shop and to manage.</p>
<h2>Two types of collection</h2>
<h3>Manual collections</h3>
<p>You add products one by one. Manual collections suit small, hand-picked groups, such as a seasonal edit or staff picks, where you want precise control. The downside is maintenance: new products are not added automatically.</p>
<h3>Automated collections</h3>
<p>You set conditions, and Shopify includes every product that matches them. Conditions can use fields such as product type, vendor, tag, price, title or inventory. You choose whether products must match all conditions or any condition. For example, an automated collection with the condition "product tag is equal to gift" includes every product tagged "gift", now and in the future.</p>
<p>Automated collections save time as your catalogue grows, but they depend on accurate and consistent product data. A mistyped tag means a product silently fails to appear. Choose the collection type carefully, because you cannot switch an existing collection between manual and automated; you would need to create a new one.</p>
<h2>Designing your collection structure</h2>
<p>Think about how your customers shop. They might browse by product type, by use or occasion, by audience or by theme. A useful structure for a small store often includes:</p>
<ul>
<li>A collection for each main product category.</li>
<li>A "New arrivals" or "Best-sellers" collection for the home page.</li>
<li>One or two themed collections for gifting or seasons.</li>
<li>An "All products" view for customers who want to browse everything.</li>
</ul>
<p>Each collection has its own title, description, image, sort order and search engine listing. Write a short description that helps both customers and search engines understand what the collection contains.</p>
<h3>Collection setup steps</h3>
<ol>
<li>Sketch your collection structure on paper based on how customers shop.</li>
<li>Decide which collections will be manual and which automated.</li>
<li>Check that your product types and tags support the automated conditions you plan.</li>
<li>Create the collections, adding descriptions, images and sort orders.</li>
<li>Make sure each collection is available on the Online Store channel.</li>
<li>Add the key collections to your main menu and home page.</li>
</ol>
<h3>Try this</h3>
<p>Create at least one manual and one automated collection. For the automated one, add a test product with the matching tag and confirm that it appears in the collection automatically, then delete the test product.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Writing product pages that sell and rank', 'Write titles, descriptions and search listings that help customers decide and search engines understand.', 'article', 3, 13, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A product page has two audiences: the shopper deciding whether to buy and the search engine deciding whether to show the page in results. Fortunately, both reward the same thing: clear, specific and helpful information.</p>
<h2>Writing for customers</h2>
<h3>Titles</h3>
<p>Use the name a customer would recognise, plus the most important distinguishing detail. "Linen apron with adjustable straps" tells shoppers more than a clever brand name on its own.</p>
<h3>Descriptions</h3>
<p>Lead with the main benefit, then answer the questions a shopper would ask in a physical shop:</p>
<ul>
<li>What is it, and who is it for?</li>
<li>What is it made of, and how is it made?</li>
<li>What are the dimensions, sizing or capacity?</li>
<li>How do I use it and care for it?</li>
<li>What is included in the box?</li>
<li>How quickly will it arrive, and can I return it?</li>
</ul>
<p>Use short paragraphs and bullet points so mobile visitors can scan. Be accurate: exaggerated claims lead to returns, complaints and, in regulated categories, legal problems.</p>
<h2>Writing for search engines</h2>
<p>Shopify lets you edit each product's search engine listing: the page title, meta description and URL handle.</p>
<ul>
<li><strong>Page title:</strong> include the main phrase a customer would search for, and keep it concise so it is not cut off in results.</li>
<li><strong>Meta description:</strong> a one- or two-sentence summary that encourages a click. Search engines may show it beneath your title, although they sometimes choose other text from the page.</li>
<li><strong>URL handle:</strong> short, readable and descriptive, with hyphens between words. If you change a handle after launch, keep the option to create a URL redirect selected so old links still work.</li>
<li><strong>Image alt text:</strong> describe what each image shows, which helps accessibility and image search.</li>
</ul>
<p>Avoid copying manufacturer descriptions word for word. Many other stores use the same text, so your page offers nothing distinctive to customers or to search engines.</p>
<h3>Product page checklist</h3>
<ol>
<li>A clear, descriptive title.</li>
<li>A benefit-led description that answers the six customer questions.</li>
<li>Several high-quality images, each with alt text.</li>
<li>Accurate variants, prices and stock.</li>
<li>Shipping and returns information visible or linked.</li>
<li>A custom page title, meta description and clean URL handle.</li>
</ol>
<h3>Try this</h3>
<p>Rewrite the description and search engine listing for your most important product using this lesson. Read the page aloud on your phone and remove any sentence that does not help a customer decide.</p>$h$));

  -- Module 4
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Payments, shipping, taxes and apps', 'Configure how you get paid, how orders ship and how tax is charged, then extend your store with apps.', 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Setting up payments and checkout', 'Activate a payment provider, choose payment methods and configure your checkout settings.', 'article', 0, 13, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Before you can take real orders, you need a way to get paid and a checkout configured the way you want. Shopify runs the secure checkout itself; your job is to connect a payment provider and choose the settings that suit your customers.</p>
<h2>Choosing a payment provider</h2>
<p>In the Shopify admin, open Settings and go to the payments area.</p>
<ul>
<li><strong>Shopify Payments</strong> is Shopify's built-in payment processor, available in a list of supported countries. It lets you accept major cards and many digital wallets without a separate provider account, and you manage payouts and disputes in the admin. To activate it, you provide business and banking details for verification.</li>
<li><strong>Third-party providers</strong> are available if Shopify Payments is not offered in your country or you need a specific provider. Depending on your plan, Shopify may charge an additional transaction fee when you use them.</li>
<li><strong>Additional methods</strong>, such as PayPal, other wallets and local payment options, can often be added alongside your main provider.</li>
<li><strong>Manual payment methods</strong>, such as bank transfer or cash on delivery, let customers order without paying online. You must confirm that payment has arrived before you fulfil the order.</li>
</ul>
<p>Check current fees, supported countries and payout schedules in the Help Center and on Shopify's pricing page before you decide.</p>
<h2>Testing payments safely</h2>
<p>Shopify Payments offers a test mode that lets you place orders with test card details and no real charges. If you use a different provider, Shopify offers a test gateway for the same purpose. Turn test mode off before launch, then place a small real order with your own card and refund it to confirm that money flows correctly.</p>
<h2>Checkout settings</h2>
<p>In the checkout area of Settings, review:</p>
<ul>
<li><strong>Customer contact method:</strong> whether customers check out with an email address, a phone number or either.</li>
<li><strong>Customer accounts:</strong> whether customers can sign in, and whether accounts are optional. Guest checkout reduces friction.</li>
<li><strong>Form fields:</strong> such as company name or a second address line. Ask only for what you need.</li>
<li><strong>Marketing consent:</strong> whether to show a sign-up option for email or SMS marketing. Follow the consent laws where your customers live.</li>
<li><strong>Order processing:</strong> options such as tipping and automatically archiving completed orders.</li>
</ul>
<h3>Payments checklist</h3>
<ol>
<li>Confirm whether Shopify Payments is available in your country.</li>
<li>Activate your payment provider and complete verification.</li>
<li>Add the wallets and local methods your customers use.</li>
<li>Set your payout bank account and note the payout schedule.</li>
<li>Review checkout settings and keep required fields to a minimum.</li>
<li>Place a test order in test mode, then a real order that you refund.</li>
</ol>
<h3>Try this</h3>
<p>Activate your payment provider and complete a full test order in test mode. Record each step you saw, from cart to confirmation email, and note anything that could confuse a first-time customer.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Shipping profiles, zones and rates', 'Set where you ship, what customers pay and how Shopify calculates delivery costs.', 'article', 1, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Shipping settings decide where customers can order from and what they pay for delivery at checkout. Mistakes here are expensive: rates set too low eat into your margin, while rates set too high lose sales. This lesson explains how Shopify's shipping settings are structured so you can configure them with confidence.</p>
<h2>How shipping settings are structured</h2>
<p>In the Shopify admin, open Settings and go to the shipping and delivery area. Shipping is organised in layers:</p>
<ul>
<li><strong>Shipping profiles</strong> group products that share rates. Every store has a general profile that applies to all products by default. You can create custom profiles for items with different costs, such as oversized or fragile products.</li>
<li><strong>Locations</strong> are where orders ship from. A profile can apply different rates depending on the origin location.</li>
<li><strong>Shipping zones</strong> are groups of countries or regions you ship to, such as domestic and international.</li>
<li><strong>Rates</strong> are the options customers see at checkout within each zone, such as Standard and Express.</li>
</ul>
<p>If a customer's address is not covered by any zone in the relevant profile, they cannot complete checkout, so make sure every destination you want to serve is included.</p>
<h2>Types of shipping rate</h2>
<ul>
<li><strong>Flat rates:</strong> a fixed price you set, such as one price for standard delivery.</li>
<li><strong>Conditional rates:</strong> rates that apply only within a range of order weight or order price. A free rate that applies only above a set order value is how you create a free shipping threshold.</li>
<li><strong>Free shipping:</strong> a rate with a price of zero, with or without conditions.</li>
<li><strong>Calculated rates:</strong> live rates from supported carriers based on parcel weight and destination. Availability depends on your country and plan, and accuracy depends on correct product weights and package sizes.</li>
<li><strong>Local delivery and pickup:</strong> options for customers near your location.</li>
</ul>
<p>In some countries you can also buy and print shipping labels from the admin, often at discounted carrier rates. Check the Help Center for availability where you are.</p>
<h3>Packages and weights</h3>
<p>Add the packages you actually use, with their dimensions and empty weight, and set a default. Combined with accurate product weights, this lets calculated rates and labels reflect your real costs.</p>
<h3>Shipping setup steps</h3>
<ol>
<li>Confirm your shipping origin address and locations.</li>
<li>Decide which countries or regions you will ship to at launch.</li>
<li>Create zones for domestic and any international regions.</li>
<li>Add rates for each zone, using your margin calculations to decide prices and thresholds.</li>
<li>Create a custom profile for any products with different shipping costs.</li>
<li>Add your packages and confirm every product has an accurate weight.</li>
<li>Test checkout with different addresses and cart sizes to see which rates appear.</li>
</ol>
<h3>Try this</h3>
<p>Set up a domestic zone with a standard rate and a free shipping rate above a threshold you have calculated. Then build carts just below and just above the threshold and confirm the correct rates appear at checkout.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Taxes and duties settings', 'Understand how Shopify calculates tax, what you must set up and where your responsibilities lie.', 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Taxes are among the most important settings to get right and among the most location-specific. Shopify can calculate and charge many sales taxes automatically, but it does not register you with tax authorities or, in most cases, file returns on your behalf. This lesson explains how the settings work and what remains your responsibility. It is not tax advice: confirm your obligations with your tax authority or an accountant.</p>
<h2>How Shopify handles tax</h2>
<p>In the Shopify admin, open Settings and go to the taxes and duties area. Tax is configured by country or region:</p>
<ul>
<li><strong>Regions and registrations:</strong> you indicate where you collect tax. In some countries, such as the United States, Shopify collects tax only in the states where you add a registration. In others, tax is collected once you set up collection for that country or region.</li>
<li><strong>Default rates:</strong> Shopify applies standard tax rates for many regions and updates them periodically. Check that they suit your business and products.</li>
<li><strong>Product-level settings:</strong> each product or variant has a setting to charge tax or not, and the product category can affect which rate applies.</li>
<li><strong>Overrides:</strong> for products or shipping that are taxed differently in a region, you can create tax overrides.</li>
</ul>
<h2>Prices with or without tax</h2>
<p>You can choose whether your product prices include tax or have tax added at checkout. Tax-inclusive prices are expected in many countries, while in others prices are usually shown before tax. Choose the convention your customers expect, and check that your prices still give the margin you planned once tax is accounted for.</p>
<h2>Selling across borders</h2>
<p>International orders can involve import duties and taxes. Shopify's international selling tools, managed through Markets, may let you estimate or collect duties and import taxes at checkout, depending on your plan and location. If you do not collect them, customers may have to pay on delivery, which can lead to refused parcels and complaints. State clearly in your shipping policy who pays duties. Some regions also have specific rules for collecting tax on imported low-value goods.</p>
<h3>Tax setup checklist</h3>
<ol>
<li>Research where you need to register for sales tax, VAT or GST, using official government guidance.</li>
<li>Register with the relevant authorities before you start collecting tax.</li>
<li>Enter your registrations and tax numbers in the tax settings.</li>
<li>Choose whether your prices include tax.</li>
<li>Check each product's tax setting and category.</li>
<li>Decide how duties are handled on international orders and state it in your policy.</li>
<li>Export tax reports regularly for your bookkeeping and filings.</li>
</ol>
<h3>Try this</h3>
<p>List every country or region you plan to sell to at launch. For each, note whether you need to register for tax and which rate applies to your main product, using official sources. Then place a test order to a sample address in each region and check that the tax shown matches what you expect.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing and managing apps safely', 'Evaluate apps on need, cost, permissions and performance before you install them.', 'article', 3, 11, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>The Shopify App Store offers a large catalogue of apps for email, subscriptions, reviews, shipping, upsells and much more. Apps can solve real problems, but each one can add a monthly cost, more settings to manage and sometimes extra code that slows your store. A disciplined approach keeps your store lean and easier to run.</p>
<h2>Start with the need, not the app</h2>
<p>Before searching the App Store, write down the problem you are trying to solve and check whether Shopify or your theme already handles it. Features such as discounts, basic email marketing, contact forms and storefront search filters may already be built in or available through free apps made by Shopify. Install a third-party app only when the need is clear and the built-in option falls short.</p>
<h2>How to evaluate an app</h2>
<ul>
<li><strong>Reviews and ratings:</strong> read recent reviews, especially critical ones, and see how the developer responds.</li>
<li><strong>Shopify badges:</strong> the "Built for Shopify" badge indicates that an app meets Shopify's standards for performance, design and integration. It is a useful signal, not a guarantee that the app fits your needs.</li>
<li><strong>Pricing:</strong> check the plan you would actually need, any usage-based charges and what happens when you exceed limits. App charges appear on your Shopify bill.</li>
<li><strong>Permissions:</strong> during installation, Shopify shows which data the app can access. Ask whether those permissions make sense for what the app does.</li>
<li><strong>Performance:</strong> apps that add storefront scripts can affect speed. Test your store speed before and after installing.</li>
<li><strong>Support:</strong> look at the support channels, response times and documentation.</li>
</ul>
<h2>Managing apps over time</h2>
<p>Review your installed apps every month. Remove anything you no longer use and make sure its subscription ends. Many modern apps add storefront features through app blocks and app embeds that you control in the theme editor, which makes them easier to remove cleanly. Older apps sometimes edited theme code directly and may leave code behind after you uninstall them. If you notice leftover elements, check the app's documentation or contact its developer.</p>
<h3>App evaluation steps</h3>
<ol>
<li>Define the problem and check the built-in options first.</li>
<li>Shortlist two or three apps and compare reviews, pricing and permissions.</li>
<li>Duplicate your theme before installing apps that change the storefront.</li>
<li>Install, configure and test the app on desktop and mobile.</li>
<li>Measure store speed before and after.</li>
<li>Record the app, its cost and its purpose in a simple app register.</li>
</ol>
<h3>Try this</h3>
<p>Create an app register spreadsheet with columns for app name, purpose, monthly cost, permissions and next review date. Add any apps you already have, then decide which single app, if any, your store genuinely needs before launch.</p>$h$));

  -- Module 5
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Launch and first marketing', 'Test everything, open your store to the public and start attracting your first customers.', 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Your pre-launch checklist and test orders', 'Test every part of the customer journey, then remove the password and go live.', 'article', 0, 14, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Launching is not a single click. It is the end of a careful check of everything a customer will see and everything that happens after they buy. A structured pre-launch review catches the small mistakes that cost sales and trust in your first weeks.</p>
<h2>Check the customer journey</h2>
<ul>
<li>Every product has an accurate title, description, images, price, variants and stock.</li>
<li>Collections show the right products, and menus link to the right pages.</li>
<li>About, Contact and FAQ pages are complete, and the contact form delivers to your inbox.</li>
<li>Refund, privacy, terms and shipping policies are published and linked.</li>
<li>The store looks and works correctly on mobile and desktop.</li>
<li>Placeholder text and demo content from the theme have been removed.</li>
<li>Store search returns sensible results for common terms.</li>
</ul>
<h2>Check what happens after an order</h2>
<h3>Test orders</h3>
<p>With payments in test mode, place several orders that cover different situations: a single item, multiple items, a product with variants, an order using a discount code, an order just above your free shipping threshold and, if you ship abroad, an international address. For each one, check the shipping rate, taxes and total.</p>
<p>Then process the orders as you would for real: fulfil one with a tracking number, cancel one and refund one. Afterwards, turn test mode off and place one real order with your own card, then refund it.</p>
<h3>Notifications</h3>
<p>Shopify sends customers emails such as order confirmations, shipping updates and refund notices. Review the notification templates in Settings, add your logo and brand colour and check that the wording matches your policies. Set up your sender email so messages come from your own domain, following Shopify's instructions for authenticating it.</p>
<h2>Going live</h2>
<p>When everything is ready, make sure you have chosen a paid plan, then remove the password protection in the Online Store preferences. While you are there, check your home page title and meta description. Review your customer privacy settings, such as cookie consent banners for regions where consent is required, before adding any analytics or advertising tracking.</p>
<h3>Launch day checklist</h3>
<ol>
<li>Payments live and test mode turned off.</li>
<li>Shipping and tax rates confirmed with test orders.</li>
<li>Notifications reviewed and sending from your domain.</li>
<li>Custom domain connected and set as primary.</li>
<li>Password removed and the store visible to the public.</li>
<li>One real order placed and refunded successfully.</li>
<li>Your support inbox monitored and ready for questions.</li>
</ol>
<h3>Try this</h3>
<p>Run the full set of test orders described above and record every issue you find in a list with its fix. Do not remove the password until every item on the launch day checklist is complete.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'First marketing steps after launch', 'Set up search visibility, email capture, sales channels and simple campaigns to win your first customers.', 'article', 1, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Removing the password makes your store public, but it does not bring visitors. Your first marketing should focus on a few channels you can sustain, built on foundations that keep paying off: search visibility, an email list and the networks you already have. Avoid spending heavily on ads until your store converts the visitors it already gets.</p>
<h2>Foundations to set up first</h2>
<h3>Search visibility</h3>
<p>Shopify generates a sitemap for your store automatically at <code>/sitemap.xml</code> on your primary domain. Verify your domain in Google Search Console, submit the sitemap so Google can discover your pages and then monitor which searches show your store. Other search engines offer similar tools, such as Bing Webmaster Tools. Organic search builds slowly, so start early.</p>
<h3>Email capture and automations</h3>
<p>Email lets you reach people who have already shown interest. Add a sign-up form to your home page and footer, offering something genuinely useful such as early access or a helpful guide. Then set up automated messages, which Shopify's marketing tools and many email apps support:</p>
<ul>
<li>A welcome email for new subscribers.</li>
<li>An abandoned checkout email for shoppers who left before paying.</li>
<li>A post-purchase thank-you with care tips and a request for feedback.</li>
</ul>
<p>Only send marketing emails to people who have given consent, and include a clear unsubscribe link in every message.</p>
<h3>Sales channels</h3>
<p>Shopify offers sales channel apps that connect your catalogue to platforms such as social networks and shopping search, so your products can appear in shopping features there. Review each channel's requirements and policies before connecting it.</p>
<h2>Your first campaigns</h2>
<ol>
<li><strong>Tell your existing network.</strong> Announce the launch to friends, communities you belong to and any audience you already have, following each community's rules on promotion.</li>
<li><strong>Post useful content.</strong> Share content that shows the product in use, explains how it is made or helps your customer solve a problem.</li>
<li><strong>Run a launch promotion with limits.</strong> Use Shopify discounts to create a code or automatic discount with an end date and usage limits, modelled against your margins.</li>
<li><strong>Ask for honest reviews.</strong> After delivery, invite customers to review their purchase. Never offer incentives that depend on the review being positive.</li>
<li><strong>Test paid campaigns cautiously.</strong> If you advertise, start with a small fixed budget, a single product or audience, and a clear measure of success based on your margins.</li>
</ol>
<h2>Measure and adjust</h2>
<p>Use Shopify Analytics to follow sessions, traffic sources, conversion rate and average order value each week. If visitors arrive but few buy, improve product pages, trust signals and checkout before buying more traffic. If visitors buy well but traffic is low, invest more in the channels that brought them.</p>
<h3>Try this</h3>
<p>Write a 30-day launch marketing plan with three channels, one launch promotion with limits and one weekly metric target. Then submit your sitemap and switch on your abandoned checkout email today.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$A freelancer is going to help you set up your store. What is the safest way to give them access?$t$, $t$Give each helper their own staff account or collaborator access with only the permissions they need. Sharing the owner login exposes billing, payouts and the ability to close the store.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Give them their own staff or collaborator access with only the permissions they need$t$, true, 0),
    (qq, $t$Share your store owner login with them$t$, false, 1),
    (qq, $t$Email them your password and change it when they finish$t$, false, 2),
    (qq, $t$Transfer store ownership to them until the work is done$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$When you connect a domain bought from another registrar, you should delete all existing DNS records before adding the records Shopify specifies.$t$, $t$False. Update only the records Shopify specifies. Deleting unrelated records, such as those used by your email provider, can stop your email from working.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, false, 0),
    (qq, $t$False$t$, true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$In the Shopify theme editor, what is a section?$t$, $t$Sections are the large, reorderable parts of a page, such as an image banner or featured collection. Blocks sit inside sections, and theme settings control store-wide styles.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$A large, reorderable part of a page, such as an image banner or featured collection$t$, true, 0),
    (qq, $t$A store-wide colour and font setting$t$, false, 1),
    (qq, $t$A single product variant$t$, false, 2),
    (qq, $t$A link in the navigation menu$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of these actions help keep your storefront fast? Select all that apply.$t$, $t$Sensibly sized images, removing unused apps and limiting autoplay video and large sliders all reduce page weight. Adding more sections or extra pop-up apps usually makes pages heavier.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Uploading images at sensible dimensions$t$, true, 0),
    (qq, $t$Removing apps you no longer use$t$, true, 1),
    (qq, $t$Limiting autoplay video and large sliders$t$, true, 2),
    (qq, $t$Adding as many sections to the home page as possible$t$, false, 3),
    (qq, $t$Installing an extra app to show pop-ups on every page$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$You want every product tagged "gift" to appear in a Gifts collection, including products you add in future. Which option should you use?$t$, $t$An automated collection with a tag condition includes every matching product automatically, now and in the future. A manual collection would need each new product added by hand.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$An automated collection with the condition that the product tag equals gift$t$, true, 0),
    (qq, $t$A manual collection$t$, false, 1),
    (qq, $t$A new navigation menu$t$, false, 2),
    (qq, $t$A custom shipping profile$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which of these can you edit in a product's search engine listing in Shopify? Select all that apply.$t$, $t$The search engine listing contains the page title, meta description and URL handle. Compare-at price and inventory quantity are set elsewhere on the product form.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Page title$t$, true, 0),
    (qq, $t$Meta description$t$, true, 1),
    (qq, $t$URL handle$t$, true, 2),
    (qq, $t$Compare-at price$t$, false, 3),
    (qq, $t$Inventory quantity$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$How do you create a free shipping threshold in Shopify's shipping settings?$t$, $t$A free shipping threshold is a rate priced at zero with a condition based on order price, so it only appears when the cart value reaches your threshold.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Add a free rate with a condition based on order price$t$, true, 0),
    (qq, $t$Turn off inventory tracking for all products$t$, false, 1),
    (qq, $t$Set every product weight to zero$t$, false, 2),
    (qq, $t$Delete all of your shipping zones$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Setting up tax collection in Shopify automatically registers your business with the relevant tax authorities.$t$, $t$False. Shopify can calculate and charge tax at checkout, but you are responsible for registering with tax authorities and meeting your filing obligations.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, false, 0),
    (qq, $t$False$t$, true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Before launch, what is the most reliable way to confirm that payments work end to end?$t$, $t$Test mode lets you check the full order flow without real charges, and one real order that you refund confirms that live payments and refunds work correctly.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Place orders in test mode, then place one real order with your own card and refund it$t$, true, 0),
    (qq, $t$Check that payment icons appear in the store footer$t$, false, 1),
    (qq, $t$Wait for the first real customer order after launch$t$, false, 2),
    (qq, $t$Leave test mode switched on after launch$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$After launch, your store receives steady visitors but very few of them buy. What should you prioritise?$t$, $t$If visitors arrive but do not buy, more traffic will mostly multiply the problem. Improve product pages, trust signals and checkout first, then invest in traffic.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Improve product pages, trust signals and checkout before buying more traffic$t$, true, 0),
    (qq, $t$Double your advertising budget straight away$t$, false, 1),
    (qq, $t$Install several new apps at once$t$, false, 2),
    (qq, $t$Remove your returns policy to simplify the page$t$, false, 3);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$This quiz checks your understanding of the whole course, from store setup and themes to products, payments, shipping, taxes, apps and launch. Answer all ten questions. You need 70% to pass, and you will see the correct answers with explanations after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'Launch-readiness audit of your Shopify store', $h$<p>In this assignment you audit the Shopify store you have built during the course and show that it is ready to launch. You can use a store on a free trial or a paid plan. The goal is to demonstrate that each part of the store has been configured deliberately, and to plan your first month of marketing.</p>
<h2>What to produce</h2>
<p>Create a launch-readiness report as a document, with screenshots where they help. Cover these four parts:</p>
<ol>
<li><strong>Store setup.</strong> Confirm your store details, currency and time zone, describe how staff or collaborator access is controlled, confirm that two-step authentication is on and show the status of your domain connection, whether connected or planned.</li>
<li><strong>Storefront and catalogue.</strong> Show your home page on mobile and desktop, list your essential pages, policies and menus, and include at least three fully set-up products with variants, inventory, weights and search engine listings. Show one manual and one automated collection and explain the condition you used.</li>
<li><strong>Payments, shipping, taxes and apps.</strong> Summarise your payment setup and test order results, your shipping zones and rates with the reasoning behind any free shipping threshold, your tax settings and the official sources you checked, and your app register with the purpose and cost of each app.</li>
<li><strong>Launch and marketing.</strong> Include your completed pre-launch checklist, noting anything still outstanding, and a 30-day marketing plan with three channels, one launch promotion with limits and one weekly metric target.</li>
</ol>
<h2>How to submit</h2>
<ul>
<li>Upload your report as a file, paste it as text, or share a link to a document with view access.</li>
<li>You may include your storefront address. If the store is password protected, you can share the storefront password, which only allows viewing the store.</li>
<li>Never share your Shopify admin login, staff credentials or payment details.</li>
</ul>
<h3>Tips for a strong submission</h3>
<ul>
<li>Explain why you made each key decision, not only what you set.</li>
<li>Be honest about gaps; a clear plan to fix them is better than hiding them.</li>
<li>Check your shipping rates and promotion against the margins you used to set your prices.</li>
</ul>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion',$t$Store setup and security$t$,'description',$t$Store details, access control, two-step authentication and domain status are correctly configured and clearly evidenced.$t$,'points',20),
        jsonb_build_object('id','c2','criterion',$t$Storefront and catalogue$t$,'description',$t$A clear, mobile-friendly storefront with essential pages, policies and menus, at least three complete products and well-structured collections.$t$,'points',30),
        jsonb_build_object('id','c3','criterion',$t$Payments, shipping, taxes and apps$t$,'description',$t$Payments tested, shipping rates and thresholds justified by margins, tax settings researched from official sources and apps chosen deliberately.$t$,'points',30),
        jsonb_build_object('id','c4','criterion',$t$Launch checklist and marketing plan$t$,'description',$t$A completed pre-launch checklist and a realistic 30-day marketing plan with channels, a limited promotion and a measurable target.$t$,'points',20)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', 'Audit your own Shopify store for launch readiness and plan your first 30 days of marketing.', 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Show that your Shopify store is ready to launch by auditing every area covered in the course and planning your first month of marketing. Read the instructions and the rubric before you start, and plan to spend at least 30 minutes on your submission.$t$));
end $$;
