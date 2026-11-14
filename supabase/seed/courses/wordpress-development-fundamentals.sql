-- Foremint Academy course content: WordPress Development Fundamentals
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'wordpress-development-fundamentals';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'WordPress Development Fundamentals',
    short_description = $t$Learn how professional developers build with WordPress. Set up a local workflow, understand hooks and the template hierarchy, build block themes with theme.json, create custom blocks and secure plugins, then ship and maintain sites with confidence.$t$,
    description = $h$<p>Many businesses, sellers and creators run their websites on WordPress, and they need developers who can build on it properly rather than stacking plugins until something works. This course teaches you the professional fundamentals: how WordPress actually works, how to build modern block themes and plugins, and how to keep your code secure, fast and maintainable.</p>
<h2>What you will learn</h2>
<p>You start by setting up a local environment with debugging enabled, WP-CLI and Git, so every project begins from a repeatable, professional workflow. You then follow a request through WordPress, from bootstrap to rendered template, and learn the concepts everything else depends on: actions and filters, the template hierarchy and the data model of posts, meta, taxonomies and options.</p>
<p>Next you build with the block editor. You will create a block theme, define a design system in <code>theme.json</code>, organise layouts with templates, template parts and patterns, and scaffold your first custom block with <code>block.json</code>.</p>
<p>The plugin module covers structure and lifecycle, custom REST API routes and, above all, security. You will learn to sanitise input, escape output, verify nonces and check capabilities, so your code holds up against the most common WordPress vulnerabilities.</p>
<p>Finally, you learn how to make sites fast with caching, efficient queries and careful asset loading, and how to deploy and maintain them with staging environments, automated deployments, tested backups and a sensible update routine.</p>
<h2>How the course works</h2>
<ul>
<li>Five modules of focused, practical lessons, each ending with a hands-on "Try this" task.</li>
<li>A course quiz that checks your understanding of every module.</li>
<li>A practical assignment where you build, secure and document a small events feature with a plugin and block theme templates.</li>
<li>A certificate when you complete every lesson and pass the quiz.</li>
</ul>
<h2>Who it is for</h2>
<p>This is an intermediate course. You should be comfortable with HTML and CSS and have written some PHP and JavaScript, even at a basic level. It suits front-end developers moving into WordPress, freelancers who want more control than page builders allow, and anyone maintaining WordPress code who wants to understand it properly.</p>
<p>The course focuses on stable concepts rather than features tied to a single release, and points you to the official WordPress developer documentation at developer.wordpress.org for reference details, so your skills stay relevant as WordPress evolves.</p>$h$,
    learning_outcomes = array[
      'Set up a repeatable local WordPress environment with debugging, WP-CLI and Git',
      'Explain the WordPress request lifecycle, hooks and template hierarchy',
      'Build a block theme and control its design system with theme.json',
      'Scaffold and register a custom block with block.json',
      'Structure plugins with hooks, custom post types and REST API routes',
      'Secure code by sanitising input, escaping output and checking nonces and capabilities',
      'Improve performance with caching, efficient queries and careful asset loading',
      'Deploy and maintain WordPress sites with version control, backups and staged updates'],
    requirements = array[
      'Comfortable writing HTML and CSS',
      'Basic PHP and JavaScript knowledge such as variables, functions and arrays',
      'Experience using the WordPress dashboard as a site owner or editor',
      'A computer where you can install development tools such as Docker or a local server app'],
    target_audience = array[
      'Front-end developers moving into WordPress projects',
      'Freelancers who build WordPress sites for clients and want more control than page builders offer',
      'Business owners and sellers who want to customise their own WordPress sites safely',
      'Developers maintaining existing WordPress codebases'],
    tags = array['wordpress','php','block-themes','plugin-development','web-security','theme-json','gutenberg'],
    level = 'intermediate',
    estimated_duration_minutes = 263,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = 'WordPress Development Fundamentals | Foremint Academy',
    seo_description = 'Build block themes, custom blocks and secure plugins. Learn hooks, theme.json, performance and deployment in a practical WordPress development course.'
  where id = c;

  -- Module 1
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Setting up a professional development workflow', $t$Build a local environment, configure WordPress for debugging and manage projects with WP-CLI and Git.$t$, 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Choosing a local WordPress development environment', $t$Compare local environment options and set up one you can rebuild in minutes.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Professional WordPress work starts on your own machine, not on a live server. A local environment lets you break things safely, see full error output and test changes before anyone else sees them. In this lesson you will compare the main options and choose one that suits the way you work.</p>
<h2>What a local environment needs to provide</h2>
<p>WordPress runs on PHP, stores data in a MySQL-compatible database such as MySQL or MariaDB, and is served by a web server such as Apache or Nginx. Any local setup must give you these three pieces, plus a way to reach the site in your browser. Good setups also let you:</p>
<ul>
<li>Switch PHP versions so you can match your production host.</li>
<li>Run several sites side by side without conflicts.</li>
<li>Recreate the whole environment from a configuration file, so teammates get an identical setup.</li>
<li>Use command-line tools such as WP-CLI and Composer.</li>
</ul>
<h2>The main options</h2>
<h3>Desktop apps</h3>
<p>Graphical apps such as Local, MAMP or XAMPP bundle a web server, PHP and a database behind a simple interface. They are quick to start with and suit freelancers who look after many small client sites. The trade-off is that configuration lives inside the app, so it is harder to share or keep under version control.</p>
<h3>Container-based tools</h3>
<p>Tools built on Docker, such as <code>wp-env</code> (the official <code>@wordpress/env</code> package) and DDEV, describe the environment in a file that lives in your project. With <code>wp-env</code>, a <code>.wp-env.json</code> file lists the WordPress version, plugins, themes and PHP version, and <code>npx @wordpress/env start</code> builds the site. Because the configuration is code, anyone on your team can reproduce it exactly. Many block and plugin developers work this way, although every lesson in this course works with any setup.</p>
<h3>Remote development servers</h3>
<p>Some teams develop on a shared server. This avoids local installs but makes debugging slower and risks people overwriting each other's work. Treat it as a complement to local development, not a replacement.</p>
<h2>Choosing for your situation</h2>
<p>If you mostly build themes and plugins, choose a container-based tool so the environment travels with the code. If you maintain many existing client sites and need to pull them down quickly, a desktop app with import tools may be faster. Whatever you choose, match the PHP version and key settings of the production host, because differences there cause the classic "it works on my machine" bugs.</p>
<h2>Setup checklist</h2>
<ol>
<li>Install the tool and its dependencies, such as Docker Desktop or an equivalent for container tools.</li>
<li>Create a project folder and initialise a Git repository in it.</li>
<li>Create a site and confirm you can log in to the dashboard.</li>
<li>Check the PHP version under <strong>Tools → Site Health → Info</strong>.</li>
<li>Write the commands to start, stop and destroy the environment in a <code>README.md</code> file.</li>
</ol>
<h2>Try this</h2>
<p>Set up a fresh local site with your chosen tool, then destroy it and rebuild it from scratch. Time how long the rebuild takes. If it needs steps you had to remember rather than read, write them into your project README now.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Configuring WordPress for development and debugging', $t$Use wp-config.php constants and environment types to surface errors safely.$t$, 'article', 1, 10, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A default WordPress install hides most errors, which is right for a live site but wrong while you are building. In this lesson you will configure <code>wp-config.php</code> so problems surface immediately on your machine and stay hidden in production.</p>
<h2>The core debugging constants</h2>
<p>WordPress reads a set of constants from <code>wp-config.php</code>. Add them above the comment that tells you to stop editing:</p>
<ul>
<li><code>define( 'WP_DEBUG', true );</code> turns on debug mode, so PHP notices, warnings and deprecation messages are reported.</li>
<li><code>define( 'WP_DEBUG_LOG', true );</code> writes those messages to <code>wp-content/debug.log</code>. You can pass a file path instead of <code>true</code> to log somewhere outside the web root.</li>
<li><code>define( 'WP_DEBUG_DISPLAY', false );</code> stops errors being printed into pages, which keeps layouts intact and avoids broken JSON in REST and AJAX responses.</li>
<li><code>define( 'SCRIPT_DEBUG', true );</code> loads unminified versions of core JavaScript and CSS, which makes browser debugging easier.</li>
</ul>
<p>Watching the log in a terminal with <code>tail -f wp-content/debug.log</code> gives you a live feed of problems as you click around the site. Pair it with Query Monitor, a free plugin that shows database queries, hooks, HTTP requests, PHP errors and the template used on each page. Install it on local and staging sites only; you will use it throughout this course.</p>
<h2>Environment types</h2>
<p>WordPress supports an environment type set with the <code>WP_ENVIRONMENT_TYPE</code> constant. Accepted values are <code>local</code>, <code>development</code>, <code>staging</code> and <code>production</code>, and <code>production</code> is the default. Your code can read it with <code>wp_get_environment_type()</code> and behave differently, for example preventing emails from leaving a local site:</p>
<p><code>if ( 'production' !== wp_get_environment_type() ) { add_filter( 'pre_wp_mail', '__return_false' ); }</code></p>
<p>Returning a non-null value from the <code>pre_wp_mail</code> filter short-circuits <code>wp_mail()</code>, so no message is sent. The same check can switch payment gateways to test mode or disable analytics outside production.</p>
<h2>Keeping configuration out of the codebase</h2>
<p>Database credentials, security salts and environment-specific constants differ between machines, so they should never be committed to Git. Common approaches include reading values from environment variables with <code>getenv()</code>, or keeping a small untracked file such as <code>wp-config-local.php</code> that the main configuration includes when it exists.</p>
<p>Never enable <code>WP_DEBUG_DISPLAY</code> on a public site. Error messages can reveal file paths, plugin names and other details that help an attacker.</p>
<h2>Checklist</h2>
<ol>
<li>Enable <code>WP_DEBUG</code>, <code>WP_DEBUG_LOG</code> and <code>SCRIPT_DEBUG</code> locally.</li>
<li>Set <code>WP_DEBUG_DISPLAY</code> to <code>false</code> and read the log instead.</li>
<li>Set <code>WP_ENVIRONMENT_TYPE</code> to <code>local</code>.</li>
<li>Install Query Monitor on your local site.</li>
<li>Confirm production uses its own, uncommitted settings.</li>
</ol>
<h2>Try this</h2>
<p>In a small test plugin, echo an undefined variable inside an <code>init</code> callback. Reload the site, find the warning in <code>debug.log</code>, read the file name and line number, then fix the code. Practising this loop now will save you hours later.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Automating everyday tasks with WP-CLI', $t$Manage installs, plugins, users and the database from the command line.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>WP-CLI is the official command-line interface for WordPress. Almost anything you can do in the dashboard, and many things you cannot, can be done with a single command. Learning it makes your work faster, repeatable and easy to script.</p>
<h2>How WP-CLI works</h2>
<p>WP-CLI loads WordPress from the current directory and runs commands against it, using the same database, plugins and configuration as the site. Many local tools include it already; with <code>wp-env</code> you run commands through <code>npx wp-env run cli wp plugin list</code>. Check your installation with <code>wp --info</code> and get help on any command with <code>wp help &lt;command&gt;</code>.</p>
<h2>Commands you will use every week</h2>
<h3>Core and configuration</h3>
<ul>
<li><code>wp core download</code> fetches the latest WordPress files.</li>
<li><code>wp config create --dbname=site --dbuser=root --prompt=dbpass</code> writes <code>wp-config.php</code>, asking for the password instead of storing it in your shell history.</li>
<li><code>wp core install --url=site.test --title="Demo" --admin_user=dev --admin_email=dev@example.com --prompt=admin_password</code> completes the installation.</li>
</ul>
<h3>Plugins, themes and users</h3>
<ul>
<li><code>wp plugin install query-monitor --activate</code> installs and activates a plugin from the WordPress.org directory.</li>
<li><code>wp plugin list --update=available</code> shows which plugins need updating.</li>
<li><code>wp theme activate my-theme</code> switches the active theme.</li>
<li><code>wp user create editor1 editor@example.com --role=editor</code> adds a test user.</li>
</ul>
<h3>Database and content</h3>
<ul>
<li><code>wp db export backup.sql</code> and <code>wp db import backup.sql</code> move databases around.</li>
<li><code>wp search-replace 'https://example.com' 'https://example.test' --dry-run</code> previews a URL change. Unlike a plain SQL replace, it safely handles serialised PHP data, which breaks when string lengths change without updating the stored lengths.</li>
<li><code>wp post generate --count=50</code> creates dummy posts for testing layouts and pagination.</li>
<li><code>wp cache flush</code> and <code>wp transient delete --all</code> clear cached data while you debug.</li>
</ul>
<h3>Scaffolding</h3>
<p><code>wp scaffold plugin my-plugin</code> generates a plugin skeleton, and <code>wp scaffold post-type</code> generates registration code for a custom post type. Treat scaffolds as a starting point and review the code before you keep it.</p>
<h2>Scripting repeatable setups</h2>
<p>Because commands are plain text, you can save a sequence in a shell script: download core, create the configuration, install, activate your theme, install the plugins you always need and import sample content. A new teammate can then run one script and have a working site. Use <code>--dry-run</code> wherever a command supports it, and always export the database before anything destructive.</p>
<h2>Checklist</h2>
<ol>
<li>Run <code>wp --info</code> to confirm WP-CLI works in your environment.</li>
<li>List plugins and themes with <code>wp plugin list</code> and <code>wp theme list</code>.</li>
<li>Export the database before any bulk change.</li>
<li>Run search-replace operations with <code>--dry-run</code> first.</li>
</ol>
<h2>Try this</h2>
<p>Write a short setup script for your project that installs WordPress, activates a default theme, installs Query Monitor and generates 20 test posts. Run it against a fresh environment and adjust it until it works with no manual steps.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Version control and project structure', $t$Decide what belongs in Git and organise a WordPress project for teamwork.$t$, 'article', 3, 10, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A WordPress site is a mix of code you write, code you install and content your users create. Treating all of it the same way leads to bloated repositories and painful deployments. This lesson shows you how to draw clear lines between them.</p>
<h2>Three kinds of files</h2>
<ul>
<li><strong>Your code</strong>: custom themes, custom plugins and must-use plugins. This always belongs in version control.</li>
<li><strong>Third-party code</strong>: WordPress core and plugins or themes from other authors. These are dependencies. Record which versions you use, but you rarely need to commit their files.</li>
<li><strong>Content and generated files</strong>: the database, the <code>wp-content/uploads</code> folder, caches and logs. These never go into Git; they are backed up and migrated separately.</li>
</ul>
<h2>Common repository layouts</h2>
<h3>One repository per theme or plugin</h3>
<p>For code you will reuse or distribute, the repository root is the theme or plugin folder itself. This keeps the project small and makes it easy to install the same plugin on many sites.</p>
<h3>One repository per site</h3>
<p>For a client site, the repository usually holds <code>wp-content</code>, or a structure where core is installed as a dependency. With Composer you can declare core, plugins and themes in <code>composer.json</code>, using the WordPress Packagist mirror for directory plugins, so every environment installs the same versions. Whichever layout you choose, document it in the README.</p>
<h3>A sensible .gitignore</h3>
<p>At minimum, ignore:</p>
<ul>
<li><code>wp-config.php</code> and any local configuration files containing secrets.</li>
<li><code>wp-content/uploads/</code>, cache folders and <code>debug.log</code>.</li>
<li><code>node_modules/</code> and <code>vendor/</code>, which are rebuilt from lock files.</li>
<li>Build output such as a <code>build/</code> folder, unless your deployment process cannot run a build step.</li>
</ul>
<p>Do commit lock files such as <code>package-lock.json</code> and <code>composer.lock</code>, so every install uses identical dependency versions.</p>
<h2>Must-use plugins</h2>
<p>PHP files placed directly in <code>wp-content/mu-plugins</code> load automatically on every request and cannot be deactivated from the dashboard. They are a good home for site-specific code that must always run, such as environment tweaks or registering a post type that content depends on. WordPress only loads files in the top level of that folder, so a plugin in a subfolder needs a small loader file next to it.</p>
<h2>Working habits</h2>
<ol>
<li>Commit small, focused changes with messages that explain why.</li>
<li>Use a branch for each feature or fix and merge it through a pull request.</li>
<li>Never edit code directly on a live server; those changes are lost on the next deployment.</li>
<li>Tag releases of themes and plugins so you can roll back.</li>
</ol>
<h2>Try this</h2>
<p>Create a repository for a theme or plugin you plan to build in this course. Add a <code>.gitignore</code> and a README describing how to start the local environment, then make your first commit. Run <code>git status</code> and confirm that no uploads, logs or secrets are tracked.</p>$h$));

  -- Module 2
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'How WordPress works', $t$Follow a request through WordPress and learn the hooks, template hierarchy and data model that everything else builds on.$t$, 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'The WordPress request lifecycle', $t$Trace what WordPress does between receiving a URL and sending back HTML.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Every time someone visits a WordPress page, the same sequence runs: load configuration, load plugins and the theme, work out what was requested, query the database and render a template. Knowing this sequence tells you where your code should run, and why code sometimes runs too early or too late.</p>
<h2>Step by step</h2>
<ol>
<li><strong>Bootstrap.</strong> The server passes the request to <code>index.php</code>, which loads <code>wp-blog-header.php</code>. That loads <code>wp-load.php</code>, then <code>wp-config.php</code>, then <code>wp-settings.php</code>, which sets up core.</li>
<li><strong>Plugins load.</strong> Must-use plugins load first, then active plugins. The <code>plugins_loaded</code> action fires once they are all included.</li>
<li><strong>The theme loads.</strong> The active theme's <code>functions.php</code> runs, with a child theme's file running before its parent's, and then <code>after_setup_theme</code> fires.</li>
<li><strong>Initialisation.</strong> The <code>init</code> action fires. This is where you register post types, taxonomies, blocks and shortcodes. <code>wp_loaded</code> follows once everything is ready.</li>
<li><strong>Parse the request.</strong> WordPress matches the URL against its rewrite rules and turns it into query variables, such as a post name or category.</li>
<li><strong>Run the main query.</strong> Those variables become the main <code>WP_Query</code>. The <code>pre_get_posts</code> action lets you modify it before it runs.</li>
<li><strong>Choose a template.</strong> After <code>template_redirect</code> fires, the template loader uses the template hierarchy to pick a file, which the <code>template_include</code> filter can override.</li>
<li><strong>Render and finish.</strong> The template outputs HTML, calling <code>wp_head()</code> and <code>wp_footer()</code> along the way, and <code>shutdown</code> fires at the very end.</li>
</ol>
<h2>Why the order matters</h2>
<p>Many bugs come from running code at the wrong moment. Calling <code>is_single()</code> inside an <code>init</code> callback always returns <code>false</code>, because the main query has not run yet. Registering a post type during <code>wp_head</code> is too late for WordPress to route its URLs. Checking capabilities directly in a plugin's main file can fail because the current user has not been set up. A useful rule of thumb:</p>
<ul>
<li>Register things such as post types, taxonomies, blocks and settings on <code>init</code> or the dedicated registration hooks.</li>
<li>Change which posts are shown on <code>pre_get_posts</code>.</li>
<li>Redirect or restrict access on <code>template_redirect</code>, after the query but before any output.</li>
<li>Add front-end assets on <code>wp_enqueue_scripts</code>.</li>
</ul>
<h2>Admin, REST and AJAX requests</h2>
<p>Not every request renders a theme template. Dashboard pages run through <code>wp-admin</code> and fire <code>admin_init</code>. REST API requests fire <code>rest_api_init</code> and return JSON instead of loading templates. The bootstrap steps are shared, so code hooked to <code>init</code> runs on all of them. Keep heavy work out of <code>init</code>, or check the context first, so you do not slow down every request.</p>
<h2>Try this</h2>
<p>With Query Monitor active, open a single post and look at its Hooks &amp; Actions panel. Find <code>init</code>, <code>pre_get_posts</code> and <code>template_redirect</code>, note which plugins attach callbacks to them, then open the Template panel to see which file rendered the page.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Hooks: actions and filters', $t$Use actions and filters to change WordPress behaviour without editing core files.$t$, 'article', 1, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Hooks are the main way you extend WordPress. Core, themes and plugins announce named moments and values, and your code attaches callbacks to them. Because of hooks you never need to edit core files, which would be overwritten by the next update.</p>
<h2>Actions: do something at a moment</h2>
<p>An action is a point in execution where WordPress lets you run code. You attach a callback with <code>add_action()</code>:</p>
<p><code>add_action( 'init', 'acme_register_book_post_type' );</code></p>
<p>When core calls <code>do_action( 'init' )</code>, every callback attached to <code>init</code> runs. Actions do not use a return value; they exist for side effects such as registering things, sending an email or printing markup.</p>
<h2>Filters: change a value</h2>
<p>A filter passes a value through your callback and uses whatever you return. Core calls <code>apply_filters( 'excerpt_length', 55 )</code>, and you can change the result:</p>
<p><code>add_filter( 'excerpt_length', function ( $length ) { return 30; } );</code></p>
<p>The golden rule of filters is to <strong>always return a value</strong>, even when you did not change it. Forgetting to return makes the value disappear, a classic cause of blank titles or missing content. Filter callbacks should also avoid side effects such as echoing output, because they may run several times or in unexpected contexts.</p>
<h2>Priority, arguments and removal</h2>
<p>Both functions accept two optional parameters after the callback:</p>
<ul>
<li><strong>Priority</strong> defaults to <code>10</code>. Lower numbers run earlier, so use <code>5</code> to run before most callbacks or <code>20</code> to run after them. Callbacks with equal priority run in the order they were added.</li>
<li><strong>Accepted arguments</strong> defaults to <code>1</code>. If a hook passes more values and you need them, say so: <code>add_filter( 'the_title', 'acme_title', 10, 2 );</code> lets your callback receive both the title and the post ID.</li>
</ul>
<p>To undo another plugin's behaviour, call <code>remove_action()</code> or <code>remove_filter()</code> with the same hook, callback and priority used to add it. Timing matters: you can only remove a callback after it has been added, so run your removal on a later hook such as <code>init</code>. Anonymous functions are hard to remove, which is a good reason to use named functions or class methods in shared code.</p>
<p>Your own plugins should offer hooks too. Calling <code>do_action( 'acme_order_saved', $order_id )</code> or <code>apply_filters( 'acme_price_label', $label, $product )</code> lets other developers extend your code without editing it. Prefix every hook name to avoid collisions.</p>
<h2>Checklist for hook callbacks</h2>
<ol>
<li>Find the right hook in the code reference on developer.wordpress.org.</li>
<li>Prefix function names or use a PHP namespace.</li>
<li>Declare how many arguments you need.</li>
<li>Return a value from every filter callback.</li>
<li>Keep callbacks fast, because some hooks fire many times per request.</li>
</ol>
<h2>Try this</h2>
<p>In a test plugin, filter <code>the_content</code> to append a short note on single posts only, checking <code>is_singular( 'post' )</code>, <code>in_the_loop()</code> and <code>is_main_query()</code>. Then remove the filter from a second plugin by calling <code>remove_filter()</code> on the <code>init</code> hook, and confirm the note disappears.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'The template hierarchy', $t$Understand how WordPress chooses a template for every URL, in classic and block themes.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Once WordPress knows what a visitor asked for, it must decide which template renders it. It does this with the template hierarchy: an ordered list of template names, from most specific to most general, ending with <code>index</code>. The first one that exists in the theme wins.</p>
<h2>How the lookup works</h2>
<p>Consider a single post of a custom post type <code>book</code> with the slug <code>dune</code>. WordPress looks for, in order:</p>
<ol>
<li><code>single-book-dune</code></li>
<li><code>single-book</code></li>
<li><code>single</code></li>
<li><code>singular</code></li>
<li><code>index</code></li>
</ol>
<p>In a classic theme these are PHP files, such as <code>single-book.php</code>. In a block theme they are HTML files in the <code>templates</code> folder, such as <code>templates/single-book.html</code>. The rules are the same.</p>
<p>Static pages follow a similar chain: a custom template assigned in the editor, then <code>page-{slug}</code>, <code>page-{id}</code>, <code>page</code>, <code>singular</code> and <code>index</code>. A category archive tries <code>category-{slug}</code>, <code>category-{id}</code>, <code>category</code>, <code>archive</code>, then <code>index</code>, and a custom post type archive tries <code>archive-{post_type}</code> before <code>archive</code>.</p>
<h2>Special templates</h2>
<ul>
<li><code>front-page</code> renders the site's front page, whether it shows latest posts or a static page.</li>
<li><code>home</code> renders the blog posts index. It causes frequent confusion because it is not necessarily the home page.</li>
<li><code>404</code> renders when nothing matches, and <code>search</code> renders search results.</li>
<li><code>taxonomy-{taxonomy}-{term}</code> and <code>author-{nicename}</code> give fine-grained control over other archives.</li>
</ul>
<h2>Working with the hierarchy</h2>
<h3>Create only what you need</h3>
<p>A theme needs only <code>index</code> to work. Add more specific templates only when the design genuinely differs, because near-identical templates multiply maintenance. In classic themes, reuse markup with <code>get_template_part()</code>; in block themes, use template parts and patterns.</p>
<h3>Debugging the chosen template</h3>
<p>When the wrong layout appears, find out which template rendered the page. Query Monitor's Template panel lists the file used and the candidates WordPress considered. In a block theme, remember that templates edited in the Site Editor are saved to the database and take priority over theme files, so a change to a file may not appear until you reset the customised template.</p>
<h3>Overriding in code</h3>
<p>The <code>template_include</code> filter receives the chosen template path and lets you return a different one. Use it sparingly, mainly in plugins that supply a template for their own content, and return the original value whenever your condition does not apply.</p>
<h2>Checklist</h2>
<ol>
<li>Identify the type of request: single, page, archive, search or 404.</li>
<li>Write out its hierarchy from most to least specific.</li>
<li>Check which templates your theme already provides.</li>
<li>Add the most general template that achieves the design.</li>
</ol>
<h2>Try this</h2>
<p>Register a <code>book</code> post type with an archive, add a few books, then create <code>single-book</code> and <code>archive-book</code> templates in your theme. Visit each URL and confirm in Query Monitor that your new templates are used.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'The WordPress data model: posts, meta, taxonomies and options', $t$Store and query data the WordPress way before reaching for custom tables.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Most WordPress data fits into a small set of database tables. Before you design custom storage, learn the built-in structures: they come with caching, admin screens, REST API support and import and export tools at no extra cost.</p>
<h2>The core structures</h2>
<ul>
<li><strong>Posts</strong> live in the <code>wp_posts</code> table. Pages, attachments, synced patterns and block templates are all posts with a different <code>post_type</code>.</li>
<li><strong>Post meta</strong> in <code>wp_postmeta</code> stores extra key and value pairs for a post, such as a book's ISBN.</li>
<li><strong>Taxonomies</strong> group posts. Categories and tags are built in, and you can register your own, such as <code>genre</code>.</li>
<li><strong>Users and user meta</strong> store accounts and per-user settings.</li>
<li><strong>Options</strong> in <code>wp_options</code> store site-wide settings.</li>
</ul>
<p>The <code>wp_</code> table prefix is configurable, which is why code should never hard-code table names.</p>
<h2>Registering your own types</h2>
<p>Register custom post types and taxonomies on <code>init</code>:</p>
<p><code>register_post_type( 'book', array( 'label' =&gt; 'Books', 'public' =&gt; true, 'has_archive' =&gt; true, 'show_in_rest' =&gt; true, 'supports' =&gt; array( 'title', 'editor', 'thumbnail', 'custom-fields' ) ) );</code></p>
<p><code>show_in_rest</code> is required for the block editor and exposes the type in the REST API. Register content types in a plugin rather than a theme, so content does not vanish when the site changes theme. After adding a post type with public URLs, flush rewrite rules once, either by visiting <strong>Settings → Permalinks</strong> or by calling <code>flush_rewrite_rules()</code> on plugin activation.</p>
<p>Describe meta with <code>register_post_meta( 'book', 'isbn', array( 'type' =&gt; 'string', 'single' =&gt; true, 'show_in_rest' =&gt; true, 'sanitize_callback' =&gt; 'sanitize_text_field' ) )</code>, then read and write it with <code>get_post_meta()</code> and <code>update_post_meta()</code>.</p>
<h2>Querying data</h2>
<p>Use <code>WP_Query</code> for custom lists, for example <code>new WP_Query( array( 'post_type' =&gt; 'book', 'posts_per_page' =&gt; 6, 'orderby' =&gt; 'title', 'order' =&gt; 'ASC' ) )</code>. Loop with <code>have_posts()</code> and <code>the_post()</code>, then call <code>wp_reset_postdata()</code> so template tags refer to the main query again.</p>
<p>To change the main query, for example to show twelve books per archive page, hook <code>pre_get_posts</code> and check <code>! is_admin()</code> and <code>$query-&gt;is_main_query()</code> instead of running a second query. Avoid <code>query_posts()</code>, which replaces the main query in a fragile way. If you must write SQL, use the global <code>$wpdb</code> object and pass every value through <code>$wpdb-&gt;prepare()</code>.</p>
<h2>Choosing where data belongs</h2>
<ol>
<li>Content with a title and its own URL: a custom post type.</li>
<li>A property of one item: meta.</li>
<li>Something that groups or filters items: a taxonomy.</li>
<li>A single site-wide setting: an option.</li>
<li>High-volume relational data such as logs: only then consider a custom table.</li>
</ol>
<h2>Try this</h2>
<p>Model a small events directory: decide which parts are a post type, which are meta, such as date and venue, and which are a taxonomy, such as event type. Register them in a plugin, add three events and list them with a <code>WP_Query</code> ordered by the date meta key.</p>$h$));

  -- Module 3
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Block themes and theme.json', $t$Build modern block themes, control design with theme.json and create your first custom block.$t$, 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Anatomy of a block theme', $t$Learn the files and folders that make up a block theme and how they fit together.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Block themes build every part of a site, including headers, footers and archives, from blocks. Site owners can edit those parts in the Site Editor, while developers define the defaults and the design system. This lesson maps out the files involved.</p>
<h2>The minimum and the typical structure</h2>
<p>A block theme needs only two files: <code>style.css</code> with a theme header comment, and <code>templates/index.html</code>. A practical theme usually contains:</p>
<ul>
<li><code>style.css</code>: the header with the theme name, version, required WordPress and PHP versions, licence and text domain. It can hold some CSS, but most styling moves to <code>theme.json</code>.</li>
<li><code>theme.json</code>: global settings and styles, covered in the next lesson.</li>
<li><code>templates/</code>: full-page templates such as <code>index.html</code>, <code>single.html</code>, <code>page.html</code>, <code>archive.html</code> and <code>404.html</code>.</li>
<li><code>parts/</code>: reusable template parts such as <code>header.html</code> and <code>footer.html</code>.</li>
<li><code>patterns/</code>: PHP files that register block patterns automatically.</li>
<li><code>styles/</code>: optional JSON files defining alternative style variations.</li>
<li><code>functions.php</code>: optional, for enqueuing extra assets or registering block styles.</li>
</ul>
<h2>What template files contain</h2>
<p>Templates are not PHP. They contain block markup: HTML plus special comments that name each block and store its attributes. A simple single-post template could consist of these lines:</p>
<ul>
<li><code>&lt;!-- wp:template-part {"slug":"header","tagName":"header"} /--&gt;</code></li>
<li><code>&lt;!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} --&gt;</code></li>
<li><code>&lt;main class="wp-block-group"&gt;&lt;!-- wp:post-title {"level":1} /--&gt; &lt;!-- wp:post-content /--&gt;&lt;/main&gt;</code></li>
<li><code>&lt;!-- /wp:group --&gt;</code></li>
<li><code>&lt;!-- wp:template-part {"slug":"footer","tagName":"footer"} /--&gt;</code></li>
</ul>
<p>You rarely type this by hand. The usual workflow is to build a layout visually in the Site Editor, then copy the markup into your theme files from the code editor view or with an export tool.</p>
<h2>Theme files versus user customisations</h2>
<p>When a site owner edits a template in the Site Editor, WordPress saves the edited version in the database as a <code>wp_template</code> or <code>wp_template_part</code> post. From then on, the database version wins over your file. Global style changes are stored in a similar way, layered on top of your <code>theme.json</code>. This has practical consequences:</p>
<ol>
<li>When you update a template file, sites where that template was customised will not show your change until the customisation is cleared.</li>
<li>While developing, edit in the Site Editor, copy or export the result into files, then reset the customisation so the file stays the single source of truth.</li>
<li>Before handing a site to a client, decide which parts they are expected to edit and document how to reset them.</li>
</ol>
<p>The Create Block Theme plugin, published by the WordPress.org team, helps by saving Site Editor changes back into theme files.</p>
<h2>Try this</h2>
<p>Create a minimal block theme with only <code>style.css</code> and <code>templates/index.html</code>, activate it and confirm it renders. Then add <code>parts/header.html</code> and <code>parts/footer.html</code>, reference them from the template and watch them appear as editable parts in the Site Editor.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Designing with theme.json', $t$Define colours, typography, spacing and layout once in theme.json and apply them everywhere.$t$, 'article', 1, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>The <code>theme.json</code> file is the control centre of a block theme. It defines which design options the editor offers, and the default styles for the whole site and for individual blocks. Getting it right means less custom CSS and a more consistent editing experience for your clients.</p>
<h2>Top-level structure</h2>
<p>A <code>theme.json</code> file is a JSON object with a few main keys:</p>
<ul>
<li><code>$schema</code>: a URL to the official schema, which gives you autocompletion and validation in most code editors.</li>
<li><code>version</code>: the schema version. Use the current version listed in the theme.json reference in the Theme Handbook.</li>
<li><code>settings</code>: which controls and presets are available.</li>
<li><code>styles</code>: how things look by default.</li>
<li><code>templateParts</code> and <code>customTemplates</code>: metadata for your template parts and optional extra templates.</li>
</ul>
<h2>Settings: presets and controls</h2>
<p>Presets are your design tokens. A colour palette is an array of objects, each with a <code>slug</code>, a <code>color</code> and a <code>name</code>:</p>
<p><code>"palette": [ { "slug": "primary", "color": "#1e4d3a", "name": "Primary" }, { "slug": "base", "color": "#ffffff", "name": "Base" } ]</code></p>
<p>For each preset, WordPress generates a CSS custom property such as <code>--wp--preset--color--primary</code>, plus the classes the editor applies when a user picks that colour. Font sizes, font families, spacing sizes and shadows work the same way, and font families can include <code>fontFace</code> definitions so WordPress loads your self-hosted font files.</p>
<p>Settings also switch controls on and off. <code>"appearanceTools": true</code> enables a group of tools such as border, margin, padding and link colour controls. Under <code>color</code>, <code>"custom": false</code> stops users choosing arbitrary colours and <code>"defaultPalette": false</code> hides the core palette, so only your brand colours appear. Under <code>layout</code>, <code>contentSize</code> and <code>wideSize</code> set the default and wide widths used by constrained layouts.</p>
<h2>Styles: global, element and block level</h2>
<ol>
<li><strong>Global</strong>: <code>styles.color.background</code> and <code>styles.typography.fontFamily</code> set site-wide defaults.</li>
<li><strong>Elements</strong>: <code>styles.elements.link</code>, <code>button</code> and <code>h1</code> to <code>h6</code> style HTML elements wherever they appear.</li>
<li><strong>Blocks</strong>: <code>styles.blocks["core/quote"]</code> styles a single block type.</li>
</ol>
<p>Reference presets instead of repeating raw values, using <code>"var:preset|color|primary"</code> or <code>"var(--wp--preset--color--primary)"</code>, so one palette change updates the whole site. JSON files in the <code>styles/</code> folder can override parts of <code>theme.json</code> to offer alternative looks, and <code>settings.blocks</code> scopes settings to one block, for example allowing custom colours only on buttons.</p>
<h2>Checklist</h2>
<ol>
<li>Add the <code>$schema</code> key and fix any validation errors your editor reports.</li>
<li>Define colour, font size and spacing presets with role-based slugs such as <code>primary</code> rather than <code>green</code>.</li>
<li>Disable controls you do not want clients to use.</li>
<li>Set element and block styles with preset references.</li>
<li>Check the result in both the editor and the front end.</li>
</ol>
<h2>Try this</h2>
<p>Define a five-colour palette and a four-step font size scale in your theme, disable the default palette and custom colours, then style links and buttons with preset references. Change one palette colour and confirm every link and button updates.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Templates, template parts and patterns', $t$Organise layouts into templates, parts and patterns so they are reusable and easy to edit.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Block themes give you three layers of reusable layout: templates for whole pages, template parts for repeated regions and patterns for ready-made groups of blocks. Using each for the right job keeps your theme flexible and easy for clients to edit.</p>
<h2>Templates and template parts</h2>
<p>Templates map to the template hierarchy you met earlier, so <code>templates/single.html</code> renders single posts. Keep them thin: a template should mostly assemble parts and a few structural blocks.</p>
<p>Template parts hold regions shared by many templates, such as the header and footer. Declare them in <code>theme.json</code> under <code>templateParts</code>, giving each a name, a title and an area such as <code>header</code>, <code>footer</code> or <code>uncategorized</code>, so the editor labels and groups them correctly. You can create alternatives, such as a minimal header for landing pages, and choose between them per template.</p>
<p>To offer a template editors can select for individual pages or posts, add an HTML file to <code>templates</code> and list it under <code>customTemplates</code> in <code>theme.json</code> with a title and the post types it applies to.</p>
<h2>Patterns</h2>
<p>Patterns are predefined block layouts, such as a hero section or a call to action, that users insert and then edit freely. Any PHP file in your theme's <code>patterns</code> folder is registered automatically. Each file starts with a header comment containing lines such as:</p>
<ul>
<li><code>Title: Hero with image</code></li>
<li><code>Slug: acme/hero-image</code></li>
<li><code>Categories: banner, featured</code></li>
<li><code>Keywords: hero, intro</code></li>
</ul>
<p>The block markup follows the header. Because pattern files are PHP, you can make text translatable with functions such as <code>esc_html_e()</code> and build image URLs with <code>esc_url( get_theme_file_uri( 'assets/hero.jpg' ) )</code> instead of hard-coding paths.</p>
<h3>Synced and unsynced patterns</h3>
<p>Patterns inserted from your theme are unsynced: each copy becomes independent content. Users can also create synced patterns in the editor, where every instance updates when the original changes, which suits something like a newsletter sign-up box repeated across pages.</p>
<h3>Patterns inside templates</h3>
<p>A template can include a pattern with <code>&lt;!-- wp:pattern {"slug":"acme/hero-image"} /--&gt;</code>. Since HTML templates cannot run PHP, this is a handy way to keep translatable text and dynamic asset URLs out of template files.</p>
<h2>Block style variations</h2>
<p>For small visual alternatives, such as an outlined button or a card-style group, register a block style rather than a new pattern. <code>register_block_style( 'core/group', array( 'name' =&gt; 'card', 'label' =&gt; 'Card' ) )</code> adds an option to the block's Styles panel and an <code>is-style-card</code> class you can target.</p>
<h2>Checklist</h2>
<ol>
<li>Keep templates thin and move shared regions into parts.</li>
<li>Register every part in <code>theme.json</code> with the right area.</li>
<li>Put marketing layouts in patterns with clear titles and categories.</li>
<li>Use PHP pattern files for translatable text and asset URLs.</li>
</ol>
<h2>Try this</h2>
<p>Create a landing page template that uses a minimal header part. Build two patterns, a hero and a call to action, and include them in the template with pattern blocks. Open the template in the Site Editor and confirm the text can be changed without touching your files.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Building your first custom block', $t$Scaffold, register and build a simple static or dynamic block with block.json.$t$, 'article', 3, 15, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Core blocks and patterns cover many needs, but sometimes you need a block with its own controls and markup, such as a product card or an alert box. Custom blocks are built with JavaScript and React for the editor, and registered with PHP. This lesson covers the essential pieces.</p>
<h2>Scaffolding a block</h2>
<p>The official <code>@wordpress/create-block</code> tool generates a working block plugin with a modern build setup. Run <code>npx @wordpress/create-block@latest acme-notice</code> in your plugins folder, activate the new plugin and the block appears in the inserter. Inside you will find:</p>
<ul>
<li><code>block.json</code>: the block's metadata, including its name, title, category, icon, attributes, supported features and asset files.</li>
<li><code>edit.js</code>: the React component that renders the block in the editor.</li>
<li><code>save.js</code> or <code>render.php</code>: how the block is output on the front end.</li>
<li><code>style.scss</code> and <code>editor.scss</code>: front-end and editor-only styles.</li>
</ul>
<p><code>npm run start</code> rebuilds files as you work and <code>npm run build</code> creates production assets in the <code>build</code> folder. Both use <code>@wordpress/scripts</code>, so you do not maintain your own build configuration.</p>
<h2>Registering with block.json</h2>
<p>The plugin's PHP file registers the block from its metadata on <code>init</code>, for example <code>register_block_type( __DIR__ . '/build/acme-notice' );</code>. The path points to the folder containing the built <code>block.json</code>, and the scaffold sets this up for you. Because metadata lives in JSON, PHP and JavaScript read the same definition, and WordPress can load a block's assets only on pages where it appears.</p>
<h2>Static versus dynamic blocks</h2>
<h3>Static blocks</h3>
<p>A static block's <code>save</code> function returns markup that is stored in post content. Display is fast because no PHP runs, but changing <code>save</code> later makes existing blocks fail validation in the editor unless you add a deprecation describing the old markup.</p>
<h3>Dynamic blocks</h3>
<p>A dynamic block stores only its attributes, and PHP renders the output on each request. Add <code>"render": "file:./render.php"</code> to <code>block.json</code>; that file receives <code>$attributes</code>, <code>$content</code> and <code>$block</code>. Print the wrapper attributes with <code>get_block_wrapper_attributes()</code> and escape everything else. Choose dynamic rendering for content that changes, such as latest posts, or when you expect the markup to evolve.</p>
<h2>Attributes and controls</h2>
<p>Attributes hold the block's data, defined in <code>block.json</code> as, for example, <code>"status": { "type": "string", "default": "info" }</code>. In <code>edit.js</code>, read <code>attributes</code> and call <code>setAttributes()</code> to update them. Spread <code>useBlockProps()</code> onto the outer element so the editor can apply selection and supports, place settings in the sidebar with <code>InspectorControls</code>, and use <code>RichText</code> for editable text. Prefer built-in <code>supports</code>, such as colour and spacing, over custom controls.</p>
<h2>Checklist</h2>
<ol>
<li>Scaffold with <code>create-block</code> and run the build in watch mode.</li>
<li>Give the block a unique namespaced name such as <code>acme/notice</code>.</li>
<li>Define attributes and supports in <code>block.json</code>.</li>
<li>Decide between static and dynamic rendering before real content exists.</li>
<li>Escape all output in <code>render.php</code>.</li>
</ol>
<h2>Try this</h2>
<p>Build a dynamic notice block with a status attribute, chosen in the sidebar from info, success or warning, and an editable message. Render it in <code>render.php</code> with a class based on the status, and check it in both the editor and the front end.</p>$h$));

  -- Module 4
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Plugin development and security', $t$Structure plugins professionally, extend WordPress with custom REST routes and protect every input and output.$t$, 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Plugin structure and lifecycle', $t$Set up a well-organised plugin and handle activation, deactivation and uninstall correctly.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Any functionality that should survive a theme change belongs in a plugin. A well-structured plugin is easy to read, safe to activate and leaves nothing behind when it is removed. This lesson covers the conventions professional plugins follow.</p>
<h2>The main plugin file</h2>
<p>A plugin is a folder in <code>wp-content/plugins</code> with a main PHP file, usually named after the folder, such as <code>acme-events/acme-events.php</code>. The file begins with a header comment that WordPress reads to list the plugin:</p>
<ul>
<li><code>Plugin Name: Acme Events</code></li>
<li><code>Description: Event listings for the Acme site.</code></li>
<li><code>Version: 1.0.0</code></li>
<li><code>Requires at least</code> and <code>Requires PHP</code>: the minimum versions you support.</li>
<li><code>License: GPL-2.0-or-later</code> and <code>Text Domain: acme-events</code></li>
</ul>
<p>Straight after the header, block direct access with <code>if ( ! defined( 'ABSPATH' ) ) { exit; }</code>, so the file does nothing if someone requests it by URL. Add the same guard to every PHP file.</p>
<h2>Organising code</h2>
<p>Keep the main file short: define constants such as the plugin path with <code>plugin_dir_path( __FILE__ )</code>, load other files and attach hooks. Group the rest by responsibility, for example <code>includes/</code> for classes, <code>admin/</code> for dashboard screens and <code>src/</code> for block or JavaScript source.</p>
<p>Everything your plugin adds to the global space must be unique. Use a PHP namespace such as <code>Acme\Events</code>, or prefix every function, class, constant, option, hook and meta key with something like <code>acme_events_</code>. Name collisions cause fatal errors or silent data corruption and are among the most common plugin bugs.</p>
<h2>Activation, deactivation and uninstall</h2>
<ul>
<li><strong>Activation</strong>: <code>register_activation_hook( __FILE__, 'acme_events_activate' )</code> runs when the plugin is activated. Use it to set default options or flush rewrite rules after registering your post types. It does not run on updates, so store a version number in an option and compare it on load to run upgrade routines.</li>
<li><strong>Deactivation</strong>: <code>register_deactivation_hook()</code> is for temporary clean-up, such as clearing scheduled events with <code>wp_clear_scheduled_hook()</code>. Do not delete user data here, because deactivation is often temporary.</li>
<li><strong>Uninstall</strong>: an <code>uninstall.php</code> file runs when the plugin is deleted from the dashboard. Start it with <code>if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) { exit; }</code>, then remove the options, tables and scheduled events your plugin created.</li>
</ul>
<p>Enqueue assets with <code>wp_enqueue_script()</code> and <code>wp_enqueue_style()</code> on <code>wp_enqueue_scripts</code> or <code>admin_enqueue_scripts</code>, only on screens that need them, and never print <code>&lt;script&gt;</code> tags directly.</p>
<h2>Checklist</h2>
<ol>
<li>A complete header with minimum versions and licence.</li>
<li>A direct access guard at the top of every PHP file.</li>
<li>A namespace or prefix on every global identifier.</li>
<li>Activation, deactivation and uninstall handled separately.</li>
<li>Assets enqueued conditionally.</li>
</ol>
<h2>Try this</h2>
<p>Create an <code>acme-events</code> plugin that registers an <code>event</code> post type, flushes rewrite rules on activation and deletes its options in <code>uninstall.php</code>. Activate, deactivate and delete it on a test site, then check with <code>wp option list --search="acme_events_*"</code> that nothing is left behind.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Extending WordPress with the REST API', $t$Register secure custom REST routes and consume them from JavaScript.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>The REST API lets JavaScript in the editor, a front-end app or an external service read and write WordPress data over HTTP using JSON. Core already exposes posts, pages, users, terms and any post type registered with <code>show_in_rest</code>. When you need something core does not provide, you can register your own routes.</p>
<h2>Exploring the built-in API</h2>
<p>Visit <code>/wp-json/wp/v2/posts</code> on your local site to see posts as JSON. Query parameters such as <code>?per_page=5</code> and <code>?search=term</code> filter the results, and <code>_fields=id,title,link</code> trims each item to just the fields you need. Before writing a custom route, check whether a core route, perhaps combined with registered meta, already covers your case.</p>
<h2>Registering a custom route</h2>
<p>Routes are registered on the <code>rest_api_init</code> action with <code>register_rest_route()</code>, which takes a versioned namespace, a route and an array of options:</p>
<p><code>register_rest_route( 'acme/v1', '/events/upcoming', array( 'methods' =&gt; WP_REST_Server::READABLE, 'callback' =&gt; 'acme_get_upcoming_events', 'permission_callback' =&gt; '__return_true', 'args' =&gt; array( 'limit' =&gt; array( 'type' =&gt; 'integer', 'default' =&gt; 5, 'minimum' =&gt; 1, 'maximum' =&gt; 20 ) ) ) );</code></p>
<p>Describing each argument with a type and limits lets WordPress validate and sanitise it against that schema before your callback runs. The callback receives a <code>WP_REST_Request</code>; read parameters with <code>$request-&gt;get_param( 'limit' )</code>, and return data with <code>rest_ensure_response()</code> or a <code>WP_Error</code> carrying an HTTP status when something fails.</p>
<h2>Permissions and authentication</h2>
<p>Every route needs a <code>permission_callback</code>, and WordPress reports a notice if you leave it out. For public, read-only data, <code>__return_true</code> states your intent clearly. For anything that changes data or exposes private information, check a capability, for example <code>function () { return current_user_can( 'edit_posts' ); }</code>. When it returns <code>false</code>, WordPress responds with an error before your callback runs.</p>
<p>JavaScript running in the dashboard or editor uses cookie authentication, which requires a nonce for the <code>wp_rest</code> action sent in the <code>X-WP-Nonce</code> header. The <code>@wordpress/api-fetch</code> package handles this for you inside the editor. External applications should use Application Passwords, created per user in their profile, and always connect over HTTPS.</p>
<h2>Checklist</h2>
<ol>
<li>Use a versioned namespace such as <code>acme/v1</code>.</li>
<li>Declare and validate every argument.</li>
<li>Write a real <code>permission_callback</code> for anything non-public.</li>
<li>Return only the fields clients need.</li>
<li>Test unauthenticated requests to confirm private routes are protected.</li>
</ol>
<h2>Try this</h2>
<p>Add an <code>acme/v1/events/upcoming</code> route to your events plugin that returns the next few events with their title, date and link. Call it in the browser. Then add a second route that creates an event, protected by a capability check, and confirm with a command-line request such as <code>curl -X POST</code> that it rejects unauthenticated requests.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Sanitising input and escaping output', $t$Apply the core rule of WordPress security: sanitise early, escape late.$t$, 'article', 2, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Most WordPress vulnerabilities come from trusting data. Cross-site scripting happens when untrusted text reaches a page unescaped; SQL injection happens when it reaches a query unprepared. The defence is a simple rule applied consistently: <strong>validate and sanitise input early, escape output late</strong>.</p>
<h2>What counts as untrusted</h2>
<p>Treat all of these as untrusted: values from <code>$_GET</code>, <code>$_POST</code>, <code>$_REQUEST</code>, <code>$_COOKIE</code> and <code>$_SERVER</code>, REST and AJAX parameters, responses from third-party APIs, and even values from your own database, which another plugin or an attacker could have changed. WordPress adds slashes to superglobals, so call <code>wp_unslash()</code> before sanitising them.</p>
<h2>Validating and sanitising input</h2>
<p><strong>Validation</strong> checks that data is what you expect and rejects it otherwise, for example a quantity must be a whole number from 1 to 10. <strong>Sanitisation</strong> cleans data into a safe shape before you store or use it. Pick the core function that matches the data:</p>
<ul>
<li><code>sanitize_text_field()</code> for single-line text and <code>sanitize_textarea_field()</code> for multi-line text.</li>
<li><code>sanitize_email()</code> and <code>is_email()</code> for email addresses.</li>
<li><code>absint()</code> for non-negative whole numbers.</li>
<li><code>sanitize_key()</code> for internal identifiers.</li>
<li><code>esc_url_raw()</code> for URLs you will store.</li>
<li><code>wp_kses_post()</code> for HTML that may contain the same tags as post content.</li>
</ul>
<p>A typical line reads <code>$title = sanitize_text_field( wp_unslash( $_POST['acme_title'] ?? '' ) );</code>. For fixed choices, validate against an allow list: <code>in_array( $status, array( 'draft', 'live' ), true )</code>.</p>
<h2>Escaping output</h2>
<p>Escape at the moment of output, using the function that matches the context:</p>
<ul>
<li><code>esc_html()</code> for text inside HTML elements.</li>
<li><code>esc_attr()</code> for attribute values.</li>
<li><code>esc_url()</code> for <code>href</code> and <code>src</code> values.</li>
<li><code>esc_textarea()</code> for content inside a textarea.</li>
<li><code>wp_kses()</code> or <code>wp_kses_post()</code> when you must output limited HTML.</li>
<li><code>wp_json_encode()</code> for data passed to JavaScript.</li>
</ul>
<p>For example: <code>echo '&lt;a href="' . esc_url( $link ) . '"&gt;' . esc_html( $label ) . '&lt;/a&gt;';</code>. Translated strings need escaping too, which is why helpers such as <code>esc_html__()</code> and <code>esc_attr_e()</code> exist. Escape even when you believe a value is safe: it makes code easy to review and protects you when data sources change.</p>
<p>For database work, prefer APIs such as <code>WP_Query</code>, which handle this internally. When you write SQL, use placeholders: <code>$wpdb-&gt;prepare( "SELECT ID FROM {$wpdb-&gt;posts} WHERE post_author = %d", $author_id )</code>.</p>
<h2>Checklist</h2>
<ol>
<li>Unslash, then sanitise every superglobal you read.</li>
<li>Validate against expected types, ranges or allow lists.</li>
<li>Escape every echo with the right function for its context.</li>
<li>Use placeholders for every variable in SQL.</li>
</ol>
<h2>Try this</h2>
<p>Search one of your themes or plugins for <code>echo</code> and <code>$_POST</code>. For each match, decide which sanitising or escaping function belongs there and add it. Then run PHP_CodeSniffer with the WordPress Coding Standards ruleset to catch anything you missed.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Nonces, capabilities and secure form handling', $t$Protect actions against forged requests and unauthorised users.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Sanitising and escaping protect the content of a request. You also need to protect the request itself: is this user allowed to do this, and did they really intend to? WordPress answers those questions with capabilities and nonces.</p>
<h2>Capabilities: is the user allowed?</h2>
<p>WordPress roles, such as administrator, editor, author, contributor and subscriber, are collections of capabilities like <code>manage_options</code>, <code>edit_posts</code> and <code>publish_posts</code>. Always check capabilities, not role names: <code>current_user_can( 'manage_options' )</code> for site settings, or the meta capability <code>current_user_can( 'edit_post', $post_id )</code> for a specific post, which accounts for authorship and post status. Being logged in, or viewing an admin page, is not proof of permission.</p>
<h2>Nonces: did they mean to?</h2>
<p>A nonce is a token tied to a user, an action and a time window. It defends against cross-site request forgery, where another site tricks a logged-in user's browser into sending a request. Add one to a form with <code>wp_nonce_field( 'acme_save_settings', 'acme_nonce' )</code>, which outputs a hidden field. When processing, verify it with <code>check_admin_referer( 'acme_save_settings', 'acme_nonce' )</code> on admin screens, <code>check_ajax_referer()</code> in AJAX handlers, or <code>wp_verify_nonce()</code> when you want to handle failure yourself. For links, <code>wp_nonce_url()</code> adds a nonce to a URL.</p>
<p>Two facts are often misunderstood. First, a nonce is <em>not</em> authorisation: it does not prove the user may perform the action, so you still need a capability check. Second, WordPress nonces can be reused within their lifetime, which is a day by default, so they are not true one-time tokens.</p>
<h2>A secure form handler</h2>
<p>For a custom admin form, post to <code>admin-post.php</code> with a hidden <code>action</code> field set to <code>acme_save</code>, and handle it on the <code>admin_post_acme_save</code> hook. The handler should:</p>
<ol>
<li>Verify the nonce.</li>
<li>Check the capability and stop with <code>wp_die()</code> if it fails.</li>
<li>Unslash, sanitise and validate each field.</li>
<li>Save the data with the appropriate API, such as <code>update_option()</code>.</li>
<li>Redirect with <code>wp_safe_redirect()</code> followed by <code>exit;</code> so refreshing the page does not resubmit the form.</li>
</ol>
<p>When saving post meta from a meta box on <code>save_post</code>, also skip autosaves and revisions, and check <code>edit_post</code> for that specific post ID.</p>
<p>For plugin settings pages, the Settings API does much of this for you. <code>register_setting()</code> with a <code>sanitize_callback</code>, combined with <code>settings_fields()</code> in the form, adds the nonce and the capability check automatically. Use it whenever your needs fit its model.</p>
<h2>Try this</h2>
<p>Add a settings screen to your events plugin that stores a default venue. Build it once with the Settings API and once with a custom <code>admin-post.php</code> handler. Test the handler by submitting without a nonce and as a user without <code>manage_options</code>, and confirm both requests are rejected.</p>$h$));

  -- Module 5
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Performance, deployment and maintenance', $t$Make sites fast, ship changes safely and keep WordPress healthy over time.$t$, 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Performance: caching, queries and assets', $t$Measure first, then fix the most common causes of slow WordPress sites.$t$, 'article', 0, 14, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A slow site loses visitors and frustrates editors. WordPress can be very fast, but performance depends on decisions you make in themes, plugins and hosting. Always measure before and after a change, so you fix real problems rather than guessed ones.</p>
<h2>Measuring</h2>
<ul>
<li>Use Query Monitor to find slow or duplicate database queries, the number of queries per page and slow HTTP requests made by plugins.</li>
<li>Use your browser's developer tools and Lighthouse to measure front-end loading, including Core Web Vitals.</li>
<li>Check <strong>Tools → Site Health</strong> for warnings about the server and configuration, such as a missing persistent object cache.</li>
</ul>
<h2>Caching layers</h2>
<h3>Page caching</h3>
<p>Full-page caching stores finished HTML and serves it to anonymous visitors without running PHP. Many hosts provide it at server level; otherwise a caching plugin can. Make sure pages with personal content, such as carts and account pages, are excluded.</p>
<h3>Object caching</h3>
<p>WordPress has an object cache API, <code>wp_cache_get()</code> and <code>wp_cache_set()</code>, which by default only lasts for a single request. Adding a persistent backend such as Redis or Memcached keeps cached objects between requests and can greatly reduce database load on dynamic pages.</p>
<h3>Transients</h3>
<p>For expensive results that can be slightly stale, such as a third-party API response, use transients: <code>set_transient( 'acme_rates', $rates, HOUR_IN_SECONDS )</code> and <code>get_transient( 'acme_rates' )</code>. A transient can disappear at any time, so always handle a <code>false</code> result by rebuilding the value.</p>
<h2>Efficient queries and assets</h2>
<ul>
<li>Limit results with <code>posts_per_page</code>, and avoid <code>-1</code> on content that can grow.</li>
<li>Pass <code>'no_found_rows' =&gt; true</code> when you do not need pagination, and <code>'fields' =&gt; 'ids'</code> when you only need IDs.</li>
<li>Avoid running queries inside loops; fetch what you need in one query.</li>
<li>Be careful with complex <code>meta_query</code> clauses on large sites, because meta values are not indexed for that kind of search. A taxonomy is often faster for filtering.</li>
<li>Store large options with autoload disabled, so they are not loaded on every request.</li>
<li>Enqueue scripts only where needed, and use the <code>strategy</code> argument of <code>wp_enqueue_script()</code> to load them with <code>defer</code> or <code>async</code>.</li>
<li>Output images with core functions such as <code>wp_get_attachment_image()</code>, which add <code>srcset</code>, <code>sizes</code> and lazy-loading attributes for you.</li>
</ul>
<p>Background work matters too. WP-Cron runs scheduled tasks when someone visits the site, so on busy or very quiet sites it is more reliable to set <code>DISABLE_WP_CRON</code> and trigger <code>wp cron event run --due-now</code> from a real server cron job.</p>
<h2>Try this</h2>
<p>Pick the slowest page on a test site. Record its query count and load time in Query Monitor, apply two improvements from this lesson, such as caching an expensive query in a transient and removing an unnecessary script, then measure again and note the difference.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Deploying and maintaining WordPress sites', $t$Move code safely between environments and keep sites secure, backed up and up to date.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Launching a site is the start of its life, not the end. Professional WordPress work includes a reliable way to ship changes and a routine for keeping the site secure, backed up and up to date.</p>
<h2>Environments and the direction of data</h2>
<p>Most teams use at least three environments: local for development, staging for testing in a production-like setting, and production for real visitors. Remember the rule: <strong>code moves up, content moves down</strong>. Code travels from local to staging to production through Git. The database and uploads are copied down from production when you need realistic data, and are never pushed up over live content without a deliberate plan.</p>
<p>When you copy a database to another environment, update URLs with <code>wp search-replace</code>, which handles serialised data correctly, and remove or anonymise personal data on non-production copies where you can.</p>
<h2>A dependable deployment process</h2>
<ol>
<li>Merge reviewed changes into your main branch.</li>
<li>Let an automated pipeline install dependencies, run the build, lint the code and run tests.</li>
<li>Deploy the built result to staging and check key pages and flows.</li>
<li>Deploy the same build to production.</li>
<li>Run follow-up commands such as cache flushes with WP-CLI.</li>
<li>Keep the previous release available so you can roll back quickly.</li>
</ol>
<p>Avoid editing files on the server or uploading them by FTP; those changes are untracked and will be overwritten. <code>define( 'DISALLOW_FILE_EDIT', true );</code> removes the theme and plugin file editors from the dashboard, and <code>DISALLOW_FILE_MODS</code> also blocks installing and updating from the dashboard, which suits sites where every code change goes through deployments.</p>
<h2>Ongoing maintenance</h2>
<h3>Updates</h3>
<p>Keep core, plugins, themes and PHP up to date, because outdated software is a common route into compromised sites. Test updates on staging first for complex sites, and enable automatic updates for low-risk components where your process allows.</p>
<h3>Backups</h3>
<p>Back up both the database and the uploads folder on a schedule, store copies away from the web server, and test restoring them regularly. A backup you have never restored is only a hope.</p>
<h3>Security and monitoring</h3>
<p>Remove unused plugins and themes, give each user the lowest role they need, require strong passwords and two-factor authentication for administrators, and serve everything over HTTPS. Monitor uptime, PHP error logs and Site Health so you hear about problems before your users do.</p>
<h2>Try this</h2>
<p>Write a one-page maintenance plan for a site you manage or are building, covering environments, deployment steps, backup schedule and storage, update routine and who is responsible for each task. Then perform a test restore of a recent backup on a local environment.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which hook is the recommended place to register custom post types and taxonomies?$t$, $t$init fires after plugins and the theme have loaded but before WordPress parses the request, so types registered there are available for routing, queries and the editor. wp_head and template_redirect run far too late.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$init$t$, true, 0), (qq, $t$wp_head$t$, false, 1), (qq, $t$template_redirect$t$, false, 2), (qq, $t$shutdown$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$After adding a filter callback, post titles on the site appear blank. What is the most likely cause?$t$, $t$A filter replaces the value with whatever the callback returns. If the callback returns nothing, the filtered value becomes empty, so every filter callback must return a value.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The callback does not return a value$t$, true, 0), (qq, $t$The priority was left at the default of 10$t$, false, 1), (qq, $t$The callback function name is prefixed$t$, false, 2), (qq, $t$The filter was added from a plugin instead of a theme$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$A visitor opens a single post of the custom post type book with the slug dune. Which template does WordPress look for first?$t$, $t$The template hierarchy runs from most to least specific: single-book-dune, then single-book, single, singular and finally index.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$single-book-dune$t$, true, 0), (qq, $t$single-book$t$, false, 1), (qq, $t$single$t$, false, 2), (qq, $t$index$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which files are required for a block theme to work? Select all that apply.$t$, $t$A block theme needs only style.css, with its header comment, and templates/index.html. theme.json is strongly recommended and functions.php and template parts are optional.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$style.css$t$, true, 0), (qq, $t$templates/index.html$t$, true, 1), (qq, $t$functions.php$t$, false, 2), (qq, $t$parts/header.html$t$, false, 3), (qq, $t$A screenshot image$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$You add a colour preset with the slug primary to theme.json. What does WordPress generate from it?$t$, $t$Each preset becomes a CSS custom property, here --wp--preset--color--primary, plus classes the editor applies, so styles can reference the token instead of a raw value.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$A CSS custom property named --wp--preset--color--primary$t$, true, 0), (qq, $t$A new block called Primary$t$, false, 1), (qq, $t$A PHP constant named PRIMARY_COLOR$t$, false, 2), (qq, $t$A row in the options table for each page$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which function should you use to escape a value printed inside an HTML attribute?$t$, $t$esc_attr() escapes values for attribute context. esc_html() is for text between tags, while sanitize_text_field() and wp_unslash() prepare input rather than escaping output.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$esc_attr()$t$, true, 0), (qq, $t$esc_html()$t$, false, 1), (qq, $t$sanitize_text_field()$t$, false, 2), (qq, $t$wp_unslash()$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Verifying a nonce proves the current user is allowed to perform the action, so a capability check is no longer needed.$t$, $t$False. A nonce protects against cross-site request forgery by confirming intent, but it is not authorisation. You must still check a capability such as manage_options or edit_post.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, false, 0), (qq, $t$False$t$, true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which steps belong in a secure handler for a custom admin form? Select all that apply.$t$, $t$A secure handler verifies the nonce, checks a capability, and unslashes and sanitises each field before saving. Hiding a form with CSS or relying on an obscure action name provides no protection.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Verify a nonce, for example with check_admin_referer()$t$, true, 0), (qq, $t$Check an appropriate capability with current_user_can()$t$, true, 1), (qq, $t$Unslash and sanitise each submitted field$t$, true, 2), (qq, $t$Hide the form from non-administrators with CSS$t$, false, 3), (qq, $t$Use a hard-to-guess action name instead of a nonce$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$wp search-replace is safer than a plain SQL REPLACE for changing a site's URL because it correctly handles serialised PHP data.$t$, $t$True. Serialised data stores string lengths, so a plain text replacement can corrupt it. wp search-replace unserialises, replaces and reserialises values safely.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, true, 0), (qq, $t$False$t$, false, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$A page calls a slow third-party API whose response can be up to an hour old. What is the most appropriate way to cache it?$t$, $t$A transient with an expiry such as HOUR_IN_SECONDS caches the result and expires automatically. Your code must still rebuild the value when get_transient() returns false.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Store it with set_transient() and an expiry of HOUR_IN_SECONDS$t$, true, 0), (qq, $t$Save it in an autoloaded option that never expires$t$, false, 1), (qq, $t$Call query_posts() to refresh the main query$t$, false, 2), (qq, $t$Disable WP_DEBUG to make the request faster$t$, false, 3);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$Ten questions covering your local workflow, hooks, the template hierarchy, block themes, plugin security, performance and deployment. You need 70% to pass, and you can review the correct answers with explanations after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'Build a secure events feature with a plugin and block theme templates', $h$<p>In this assignment you bring the whole course together by building a small, production-quality feature: an events listing for a WordPress site. Work in your local environment and keep your code in a Git repository from the start.</p>
<h2>What to build</h2>
<ol>
<li><strong>A plugin</strong>, prefixed or namespaced with your own identifier, that registers an <code>event</code> post type with an archive and REST support, and an <code>event_type</code> taxonomy, on <code>init</code>.</li>
<li><strong>Event details</strong>: register post meta for the event date and venue with <code>register_post_meta()</code>, including sanitise callbacks, and let editors set them, either through a meta box with nonce and capability checks or through a panel in the editor sidebar.</li>
<li><strong>A settings screen</strong> that stores at least one option, such as how many upcoming events to show, built with the Settings API or a secure <code>admin-post.php</code> handler.</li>
<li><strong>Front-end output</strong>: a dynamic block or a shortcode that lists upcoming events ordered by date, using an efficient query and escaping every value for its context.</li>
<li><strong>Theme integration</strong>: in a block theme, either your own or a child of a default theme, add <code>single-event</code> and <code>archive-event</code> templates and at least one colour or typography change made through <code>theme.json</code> presets.</li>
<li><strong>A clean lifecycle</strong>: flush rewrite rules on activation and remove the plugin's options in <code>uninstall.php</code>.</li>
</ol>
<h2>What to submit</h2>
<ul>
<li>A link to your repository, or a zip file of the plugin and theme folders.</li>
<li>A README covering setup steps, the main hooks you used and why, and how you would deploy the feature to staging and production.</li>
<li>Screenshots of the events archive, a single event and your settings screen.</li>
<li>A short security note listing every place you sanitise input, verify a nonce, check a capability or escape output.</li>
</ul>
<h2>Before you submit</h2>
<ul>
<li>Run the site with <code>WP_DEBUG</code> enabled and confirm <code>debug.log</code> contains no notices from your code.</li>
<li>Submit your forms as a user without the required capability and confirm the requests are rejected.</li>
<li>Deactivate and delete the plugin on a test copy and confirm it cleans up after itself.</li>
<li>Check that your repository contains no credentials, uploads, <code>node_modules</code> or <code>vendor</code> folders.</li>
</ul>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion',$t$Plugin architecture and WordPress APIs$t$,'description',$t$Hooks, post type, taxonomy, meta and lifecycle functions are used correctly, code is prefixed or namespaced, and the file structure is clear.$t$,'points',30),
        jsonb_build_object('id','c2','criterion',$t$Security$t$,'description',$t$Input is unslashed, sanitised and validated, output is escaped for its context, and nonces and capabilities are checked on every request that changes data.$t$,'points',30),
        jsonb_build_object('id','c3','criterion',$t$Theme integration and front-end output$t$,'description',$t$Templates follow the hierarchy, theme.json changes use presets, and the events list uses an efficient query and renders correctly in the editor and on the front end.$t$,'points',20),
        jsonb_build_object('id','c4','criterion',$t$Documentation and workflow$t$,'description',$t$The README explains setup, decisions and deployment, the repository excludes secrets and generated files, and the code runs without debug notices.$t$,'points',20)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', $t$Build, secure and document a small events feature with a plugin and block theme templates.$t$, 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Put the course into practice by building, securing and documenting a small events feature. Read the brief and the rubric before you start, plan your plugin structure, then build it step by step in your local environment.$t$));
end $$;
