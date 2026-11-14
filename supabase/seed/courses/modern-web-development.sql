-- Foremint Academy course content: Modern Web Development Foundations
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'modern-web-development';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'Modern Web Development Foundations',
    short_description = $t$Learn how the web works and build your first real websites. Write semantic, accessible HTML, lay out responsive pages with flexbox and grid, add interactivity with JavaScript, fetch data from APIs, track your work with Git and deploy your site to the web.$t$,
    description = $h$<p>Every business, shop and creator needs a presence on the web. Understanding how websites are built gives you more control over yours, whether you want to build sites professionally or simply feel confident when working with developers. This course takes you from no coding experience to building and publishing a real, responsive and accessible website.</p>
<h2>What you will learn</h2>
<p>You begin with how the web actually works: what happens between typing an address and seeing a page, how HTTP requests and responses work, and how to set up a professional toolkit with a code editor, browser developer tools, the terminal and Git.</p>
<p>Next you learn to write semantic HTML that browsers, search engines and assistive technologies understand, including well-structured content, images with useful alternative text and forms that anyone can complete. Accessibility is built in from the start rather than added at the end.</p>
<p>In the CSS module you learn how the cascade and the box model work, then build layouts with flexbox and grid and make them responsive with a mobile-first approach, fluid sizing and container queries.</p>
<p>With JavaScript you learn the core language, then use it to update the page through the DOM, respond to user events and fetch data from APIs while handling loading and error states properly.</p>
<p>Finally, you see what modern frameworks and build tools solve, how to decide whether you need one, and how to deploy your site from Git to a live address served over HTTPS.</p>
<h2>How the course works</h2>
<ul>
<li>Five modules of short, practical lessons, each ending with a "Try this" task.</li>
<li>A practice website that grows lesson by lesson throughout the course.</li>
<li>A course quiz covering every module.</li>
<li>A practical assignment: build and deploy an accessible, responsive one-page site.</li>
<li>A certificate when you complete every lesson and pass the quiz.</li>
</ul>
<h2>Who it is for</h2>
<p>This is a beginner course and assumes no coding experience. It suits aspiring developers, entrepreneurs and sellers who want to understand and customise their own sites, freelancers adding web skills to their services, and designers or marketers who work alongside developers.</p>
<p>The lessons focus on stable fundamentals rather than passing trends, and point you to MDN Web Docs at developer.mozilla.org for deeper reference, so what you learn stays useful as tools change.</p>$h$,
    learning_outcomes = array[
      'Explain what happens between typing a URL and seeing a page',
      'Write semantic, accessible HTML for content and forms',
      'Build responsive layouts with flexbox, grid and media queries',
      'Use JavaScript to update the page and respond to user events',
      'Fetch and display data from a web API with proper error handling',
      'Track and share your work with Git',
      'Understand what frameworks offer and when to use one',
      'Deploy a website to the internet over HTTPS'],
    requirements = array[
      'A computer with a modern web browser',
      'Permission to install free software such as a code editor, Node.js and Git',
      'Comfort working with files and folders; no prior coding experience needed'],
    target_audience = array[
      'Complete beginners who want to start building for the web',
      'Entrepreneurs and sellers who want to understand and customise their own websites',
      'Freelancers adding web development to their services',
      'Designers and marketers who want to work confidently with developers'],
    tags = array['web-development','html','css','javascript','accessibility','responsive-design','git','beginner'],
    level = 'beginner',
    estimated_duration_minutes = 270,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = 'Modern Web Development Foundations | Foremint Academy',
    seo_description = 'Learn HTML, CSS, JavaScript, APIs, Git and deployment from the ground up. Build accessible, responsive websites in this practical beginner course.'
  where id = c;

  -- Module 1
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'How the web works and your developer toolkit', $t$Understand browsers, servers and HTTP, set up your tools and start tracking your work with Git.$t$, 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'What happens when you visit a website', $t$Follow a request from the address bar to a rendered page.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>You use the web every day, but as a developer you need to know what happens behind the address bar. Understanding the journey from URL to page will help you debug problems, make sites faster and talk confidently with hosting providers and other developers.</p>
<h2>Clients, servers and URLs</h2>
<p>The web is built on a simple model. A <strong>client</strong>, usually a browser, asks for a resource. A <strong>server</strong>, a computer connected to the internet, responds with it. Each resource is identified by a URL such as <code>https://shop.example.com/products?page=2</code>, which has several parts:</p>
<ul>
<li><code>https</code>: the scheme, or protocol, used to communicate.</li>
<li><code>shop.example.com</code>: the host name of the server.</li>
<li><code>/products</code>: the path to the resource on that server.</li>
<li><code>?page=2</code>: a query string carrying extra parameters.</li>
</ul>
<p>Code that runs in the browser is called the <strong>front end</strong>. Code that runs on the server, often talking to a database, is the <strong>back end</strong>. This course focuses on the front end, but you will see how the two connect.</p>
<h2>From address bar to page</h2>
<ol>
<li><strong>DNS lookup.</strong> Computers find each other by IP address, so the browser asks the Domain Name System to translate the host name into an address. Results are cached to save time on later visits.</li>
<li><strong>Connection.</strong> The browser opens a connection to the server. For HTTPS, a TLS handshake follows: the server proves its identity with a certificate, and both sides agree on encryption keys.</li>
<li><strong>Request.</strong> The browser sends an HTTP request, such as <code>GET /products</code>, with headers describing what it can accept.</li>
<li><strong>Response.</strong> The server replies with a status code, headers and a body, which for a web page is HTML.</li>
<li><strong>Parsing.</strong> The browser reads the HTML and builds the Document Object Model, or DOM, a tree of elements. Along the way it finds references to CSS, JavaScript, images and fonts, and requests each one.</li>
<li><strong>Rendering.</strong> The browser combines CSS with the DOM to work out styles, calculates the layout, paints pixels and composes the final page. JavaScript can change the DOM at any point, which may trigger more layout and painting.</li>
</ol>
<h2>Why this matters to you</h2>
<p>Each step is a place where things can be slow or break. A misconfigured DNS record makes a site unreachable. An expired certificate shows visitors a security warning. Large images and scripts delay rendering. Many techniques you will learn in this course, such as loading scripts with <code>defer</code> and sizing images correctly, exist to make these steps faster and more reliable.</p>
<h2>Try this</h2>
<p>Open your browser's developer tools, switch to the Network tab and reload a website you use often. Click the first request, which is the HTML document, and find its status code, its response headers and how long it took. Then sort the requests by size and note the three largest files the page downloads.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'HTTP in practice: methods, status codes and headers', $t$Read and reason about HTTP requests and responses like a developer.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>HTTP is the language browsers and servers use to talk to each other. Every page load, form submission and API call is an HTTP request followed by a response. Once you can read them, many confusing bugs become easy to diagnose.</p>
<h2>Requests and methods</h2>
<p>A request contains a method, a URL, headers and sometimes a body. The method states the intent:</p>
<ul>
<li><code>GET</code> retrieves data. It should never change anything on the server, so browsers and caches can repeat it safely.</li>
<li><code>POST</code> submits data, such as a form or a new order. Repeating it may create duplicates.</li>
<li><code>PUT</code> replaces a resource, and <code>PATCH</code> updates part of one.</li>
<li><code>DELETE</code> removes a resource.</li>
</ul>
<h2>Responses and status codes</h2>
<p>Every response includes a three-digit status code, and the first digit tells you the category:</p>
<ul>
<li><strong>2xx success</strong>: <code>200 OK</code>, <code>201 Created</code> after creating something, and <code>204 No Content</code> when there is nothing to return.</li>
<li><strong>3xx redirection</strong>: <code>301 Moved Permanently</code> for a permanent URL change, <code>302 Found</code> or <code>307 Temporary Redirect</code> for temporary ones, and <code>304 Not Modified</code> when the browser's cached copy is still valid.</li>
<li><strong>4xx client errors</strong>: <code>400 Bad Request</code>, <code>401 Unauthorized</code> when you are not logged in, <code>403 Forbidden</code> when you are logged in but not allowed, <code>404 Not Found</code> and <code>429 Too Many Requests</code>.</li>
<li><strong>5xx server errors</strong>: <code>500 Internal Server Error</code> and <code>503 Service Unavailable</code>. These mean the problem is on the server, not in the request.</li>
</ul>
<p>The category tells you where to look. A 4xx error usually means the request must change; a 5xx error means you should check the server and its logs.</p>
<h2>Headers</h2>
<p>Headers carry metadata as name and value pairs. You will meet these constantly:</p>
<ul>
<li><code>Content-Type</code> describes the body, such as <code>text/html</code> or <code>application/json</code>.</li>
<li><code>Cache-Control</code> tells browsers and caches how long they may reuse a response.</li>
<li><code>Set-Cookie</code> and <code>Cookie</code> carry small pieces of state, such as a login session.</li>
<li><code>Location</code> gives the destination of a redirect.</li>
<li><code>Authorization</code> sends credentials such as an API token.</li>
</ul>
<p>HTTP is stateless: each request stands alone, which is why cookies and tokens exist to identify users across requests. Always use HTTPS, so headers and bodies, including passwords and cookies, are encrypted in transit.</p>
<h2>Checklist for debugging a request</h2>
<ol>
<li>Find the request in the Network tab of your browser's developer tools.</li>
<li>Check that the method and full URL are what you expected.</li>
<li>Read the status code and decide whether the problem is on the client or the server.</li>
<li>Inspect the request and response headers, especially <code>Content-Type</code>.</li>
<li>Look at the response body for an error message.</li>
</ol>
<h2>Try this</h2>
<p>Visit a page that does not exist on any website and find the 404 response in the Network tab. Then use the search form on a site you know, and work out whether it sent a GET or a POST request and where your search term appears.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Setting up your toolkit: editor, browser DevTools and terminal', $t$Install and learn the three tools you will use in every project.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Web developers spend their days in three tools: a code editor, the browser's developer tools and a terminal. Setting them up well now will make every later lesson smoother.</p>
<h2>A code editor</h2>
<p>A good code editor highlights syntax, completes code as you type and catches mistakes early. Visual Studio Code is a popular free choice, but any modern editor works. Whichever you choose, set it up to:</p>
<ul>
<li>Format code automatically on save, for example with the Prettier extension, so your files stay consistent.</li>
<li>Show problems reported by a linter such as ESLint for JavaScript.</li>
<li>Open a whole project folder rather than individual files.</li>
</ul>
<p>Learn a handful of shortcuts early: open a file by name, search across the project, comment out a line and use multiple cursors. They save a lot of time over a career.</p>
<h2>Browser developer tools</h2>
<p>Every major browser includes developer tools, usually opened with <strong>F12</strong> or by right-clicking an element and choosing <strong>Inspect</strong>. The panels you will use most are:</p>
<ul>
<li><strong>Elements</strong>, called Inspector in some browsers: view the live DOM and edit HTML and CSS to experiment without changing your files.</li>
<li><strong>Console</strong>: see JavaScript errors and run JavaScript directly.</li>
<li><strong>Network</strong>: inspect every request the page makes.</li>
<li><strong>Device toolbar</strong> or responsive design mode: preview your page at different screen sizes.</li>
<li><strong>Lighthouse</strong> or a similar audit panel: check performance, accessibility and best practices.</li>
</ul>
<p>Changes made in developer tools disappear when you reload. Once an experiment works, copy it into your source files.</p>
<h2>The terminal</h2>
<p>The terminal lets you control your computer with text commands, and many developer tools only work this way. Start with a few commands:</p>
<ul>
<li><code>pwd</code> shows which folder you are in, and <code>ls</code> lists its contents; in the Windows Command Prompt the equivalent is <code>dir</code>.</li>
<li><code>cd projects</code> moves into a folder, and <code>cd ..</code> moves up one level.</li>
<li><code>mkdir my-site</code> creates a folder.</li>
</ul>
<p>Also install Node.js, which includes <code>npm</code>, the package manager used to install JavaScript tools. Run <code>node --version</code> and <code>npm --version</code> to confirm both work. Choose the long-term support release unless a project says otherwise.</p>
<h2>Setup checklist</h2>
<ol>
<li>Install a code editor and turn on format on save.</li>
<li>Open developer tools in your browser and find each panel listed above.</li>
<li>Open a terminal and create a <code>projects</code> folder using commands only.</li>
<li>Install Node.js and confirm the version commands work.</li>
</ol>
<h2>Try this</h2>
<p>Create a folder called <code>my-first-site</code> from the terminal, open it in your editor and add an <code>index.html</code> file containing a heading. Open the file in your browser, then use the Elements panel to change the heading text and colour live.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Tracking your work with Git', $t$Use Git to save snapshots of your work, experiment safely and share code.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Git is a version control system. It records snapshots of your project over time, so you can see what changed, undo mistakes and work with other people without overwriting each other's work. Almost every development team uses it, and you will use it for the rest of this course.</p>
<h2>Core ideas</h2>
<ul>
<li>A <strong>repository</strong> is a project folder that Git tracks, including its full history.</li>
<li>A <strong>commit</strong> is a saved snapshot with a message describing the change.</li>
<li>The <strong>staging area</strong> is where you choose which changes go into the next commit.</li>
<li>A <strong>branch</strong> is an independent line of work. The main branch holds stable work, and you create other branches for features or experiments.</li>
<li>A <strong>remote</strong> is a copy of the repository hosted elsewhere, on a service such as GitHub, GitLab or Bitbucket.</li>
</ul>
<h2>The everyday workflow</h2>
<p>Before your first commit, tell Git who you are with <code>git config --global user.name "Your Name"</code> and <code>git config --global user.email "you@example.com"</code>. Then the daily loop is:</p>
<ol>
<li><code>git init</code> turns the current folder into a repository. Run it once per project.</li>
<li><code>git status</code> shows which files have changed. Run it often.</li>
<li><code>git add index.html</code> stages one file, and <code>git add .</code> stages everything that changed.</li>
<li><code>git commit -m "Add contact form"</code> saves a snapshot.</li>
<li><code>git log --oneline</code> lists your history.</li>
</ol>
<h2>Branches and remotes</h2>
<p>To try something without risking working code, create a branch with <code>git switch -c new-header</code> and make commits there. Return with <code>git switch main</code> and combine the work with <code>git merge new-header</code>. If the experiment fails, delete the branch. Depending on your settings, the default branch may be called <code>main</code> or <code>master</code>; <code>git config --global init.defaultBranch main</code> sets it for new repositories.</p>
<p>To back up and share your work, create an empty repository on a hosting service, connect it with <code>git remote add origin &lt;url&gt;</code> and upload with <code>git push -u origin main</code>. Later, <code>git pull</code> downloads changes others have pushed, and <code>git clone &lt;url&gt;</code> copies an existing repository to your machine. On teams, changes usually go through a pull request, where others review the code before it is merged.</p>
<h2>Good habits</h2>
<ul>
<li>Commit small, related changes with messages that say what changed and why.</li>
<li>Add a <code>.gitignore</code> file listing things Git should not track, such as <code>node_modules/</code> and files containing passwords or API keys.</li>
<li>Never commit secrets. If you do, treat them as exposed and replace them, because they remain in the history.</li>
</ul>
<h2>Try this</h2>
<p>Turn your <code>my-first-site</code> folder into a repository and make a first commit. Create a branch, change the heading, commit, and merge the branch back into main. Finally, push the repository to a free account on a Git hosting service.</p>$h$));

  -- Module 2
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Semantic HTML and accessibility', $t$Structure content with meaningful HTML and make it usable for everyone.$t$, 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Structuring a page with semantic HTML', $t$Use the right HTML elements so browsers, search engines and assistive technology understand your content.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>HTML describes the meaning and structure of content. When you choose elements that match their purpose, browsers, search engines and assistive technologies such as screen readers can understand your page. This is called semantic HTML, and it is the foundation of accessible, maintainable websites.</p>
<h2>The document skeleton</h2>
<p>Every page starts with the same essentials:</p>
<ul>
<li><code>&lt;!DOCTYPE html&gt;</code> tells the browser to use standards mode.</li>
<li><code>&lt;html lang="en"&gt;</code> sets the page language, which screen readers use for pronunciation.</li>
<li>Inside <code>&lt;head&gt;</code>: <code>&lt;meta charset="utf-8"&gt;</code> for correct characters, <code>&lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;</code> so mobile devices do not show a zoomed-out page, a descriptive <code>&lt;title&gt;</code>, and a <code>&lt;meta name="description"&gt;</code> for search results.</li>
<li><code>&lt;body&gt;</code> contains everything visitors see.</li>
</ul>
<h2>Landmark elements</h2>
<p>Landmarks divide a page into regions that assistive technology users can jump between:</p>
<ul>
<li><code>&lt;header&gt;</code>: introductory content, such as the logo and site name.</li>
<li><code>&lt;nav&gt;</code>: major navigation links.</li>
<li><code>&lt;main&gt;</code>: the main content. Use one visible <code>main</code> per page.</li>
<li><code>&lt;article&gt;</code>: self-contained content that makes sense on its own, such as a blog post or product card.</li>
<li><code>&lt;section&gt;</code>: a thematic group of content, usually with its own heading.</li>
<li><code>&lt;aside&gt;</code>: related but secondary content, such as a sidebar.</li>
<li><code>&lt;footer&gt;</code>: closing content such as contact details and legal links.</li>
</ul>
<p>Use <code>&lt;div&gt;</code> and <code>&lt;span&gt;</code> only when no meaningful element fits, typically as hooks for styling.</p>
<h2>Headings create an outline</h2>
<p>Headings from <code>&lt;h1&gt;</code> to <code>&lt;h6&gt;</code> form an outline of the page, and many screen reader users navigate by them. Follow these rules:</p>
<ol>
<li>Give each page one <code>h1</code> describing its main topic.</li>
<li>Use <code>h2</code> for major sections and <code>h3</code> for subsections within them.</li>
<li>Do not skip levels, such as jumping from <code>h2</code> to <code>h4</code>.</li>
<li>Never choose a heading level for its size; change the size with CSS instead.</li>
</ol>
<h2>Why semantics pay off</h2>
<p>Semantic markup gives you keyboard and screen reader support with no extra code, makes your CSS easier to write because the structure is clear, and helps search engines understand what each part of the page is about. It also makes your code easier for the next developer, or your future self, to read.</p>
<h2>Try this</h2>
<p>Sketch a simple business homepage on paper: a header with navigation, a hero section, three service cards, a contact section and a footer. Label each region with the semantic element you would use, then build that skeleton in your <code>index.html</code> file using only those elements and headings, with placeholder text.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Text, links, images and media', $t$Mark up everyday content correctly, from paragraphs and lists to images and video.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Most of a web page is ordinary content: paragraphs, lists, links and images. Marking each one up correctly makes it readable for everyone, quick to load and easy to style.</p>
<h2>Text and lists</h2>
<ul>
<li>Use <code>&lt;p&gt;</code> for paragraphs rather than line breaks between blocks of text.</li>
<li>Use <code>&lt;ul&gt;</code> when order does not matter, <code>&lt;ol&gt;</code> for steps or rankings, and <code>&lt;li&gt;</code> for each item. Navigation menus are usually a list of links inside a <code>nav</code>.</li>
<li>Use <code>&lt;strong&gt;</code> for important text and <code>&lt;em&gt;</code> for stress emphasis. For purely visual bold or italic, use CSS.</li>
<li>Use <code>&lt;blockquote&gt;</code> for quotations and <code>&lt;time datetime="2025-03-01"&gt;</code> for dates that machines should understand.</li>
</ul>
<h2>Links</h2>
<p>A link looks like <code>&lt;a href="/pricing"&gt;See pricing&lt;/a&gt;</code>. Good link text describes the destination on its own, because screen reader users often list all the links on a page out of context. Avoid vague text such as "click here".</p>
<ul>
<li>Use paths such as <code>/about</code> for pages on your own site and full URLs for other sites.</li>
<li>Link to a section of the same page with an <code>id</code>: <code>&lt;a href="#faq"&gt;</code> points to the element with <code>id="faq"</code>.</li>
<li>Use links to go somewhere and buttons to do something. A link that only runs JavaScript should usually be a <code>&lt;button&gt;</code>.</li>
</ul>
<h2>Images and media</h2>
<p>Every <code>&lt;img&gt;</code> needs an <code>alt</code> attribute that describes what the image communicates in context, for example <code>alt="Blue canvas tote bag with leather handles"</code> on a product page. If an image is purely decorative, use an empty value, <code>alt=""</code>, so screen readers skip it. Never leave <code>alt</code> out entirely, or some screen readers will read the file name aloud.</p>
<p>Add <code>width</code> and <code>height</code> attributes that match the image's proportions, so the browser reserves space and the layout does not jump while images load. Add <code>loading="lazy"</code> to images further down the page so they load only when needed, but not to the main image at the top. Use modern formats such as WebP or AVIF where you can, and never upload images far larger than their display size.</p>
<p>For a caption, wrap the image in <code>&lt;figure&gt;</code> with a <code>&lt;figcaption&gt;</code>. For video, use <code>&lt;video controls&gt;</code> and provide captions with a <code>&lt;track&gt;</code> element.</p>
<h2>Content checklist</h2>
<ol>
<li>Every paragraph, list and quotation uses the matching element.</li>
<li>Link text makes sense out of context.</li>
<li>Every image has a suitable <code>alt</code> value, empty for decoration.</li>
<li>Images have dimensions, and those below the fold lazy-load.</li>
</ol>
<h2>Try this</h2>
<p>Fill the skeleton you built in the previous lesson with real content: a short introduction, a list of services, links between sections and three images with carefully written <code>alt</code> text. Then inspect the page with the accessibility tree view in your browser's developer tools.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Building accessible forms', $t$Create forms that are easy to complete, validate and use with any input method.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Forms are where users sign up, buy and get in touch, so a confusing form costs you real customers. Well-built forms rely mostly on native HTML, which gives you keyboard support, validation and mobile-friendly keyboards with no extra code.</p>
<h2>Labels and inputs</h2>
<p>Every input needs a visible label linked to it. Connect them with matching <code>for</code> and <code>id</code> values:</p>
<p><code>&lt;label for="email"&gt;Email address&lt;/label&gt; &lt;input id="email" name="email" type="email" autocomplete="email" required&gt;</code></p>
<p>Screen readers announce the label when the field gains focus, and clicking the label focuses the field, which enlarges the target on touch screens. Placeholder text is not a substitute for a label: it disappears as soon as someone types and often has poor contrast.</p>
<h2>Choosing the right input</h2>
<ul>
<li><code>type="email"</code>, <code>type="tel"</code> and <code>type="url"</code> bring up suitable keyboards on phones and add basic validation. Use <code>type="number"</code> only for genuine quantities.</li>
<li><code>type="date"</code> gives a native date picker.</li>
<li>Use <code>&lt;select&gt;</code> for one choice from many options, radio buttons for one choice from a few, and checkboxes for independent yes or no options.</li>
<li>Use <code>&lt;textarea&gt;</code> for longer messages.</li>
<li>Add <code>autocomplete</code> values such as <code>name</code>, <code>email</code> and <code>postal-code</code> so browsers can fill in details for users.</li>
</ul>
<p>Group related radio buttons or checkboxes in a <code>&lt;fieldset&gt;</code> with a <code>&lt;legend&gt;</code> that asks the question, such as "Preferred contact method".</p>
<h2>Validation and errors</h2>
<p>Attributes such as <code>required</code>, <code>minlength</code>, <code>maxlength</code> and <code>pattern</code> let the browser check input before submission. They improve the experience but are not security: anyone can bypass them, so the server must always validate again.</p>
<p>When something is wrong, users need to know what happened and how to fix it:</p>
<ol>
<li>Show the error message next to the field, in text, not only through colour.</li>
<li>Write specific messages, such as "Enter an email address in the format name@example.com".</li>
<li>Connect the message to its input with <code>aria-describedby</code> so screen readers announce it.</li>
<li>Keep the data the user already entered so they do not have to start again.</li>
</ol>
<h2>Buttons and keyboard use</h2>
<p>Submit forms with a real <code>&lt;button type="submit"&gt;</code> whose text says what happens, such as "Send message". Buttons inside a form submit it by default, so give any other buttons <code>type="button"</code>. Make sure the whole form can be completed with only the keyboard: Tab to move between fields, Space or Enter to activate controls.</p>
<h2>Try this</h2>
<p>Build a contact form with fields for name and email, a reason for contacting you chosen from radio buttons in a fieldset, and a message. Complete it using only your keyboard, then submit it empty and check that the browser's validation messages appear and make sense.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Accessibility fundamentals and testing', $t$Apply the core principles of accessibility and test your pages like a professional.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Accessibility means people can use your site regardless of disability, device or situation. That includes people who use screen readers, people who cannot use a mouse, people with low vision or colour blindness, and people with cognitive differences. It also helps everyone else, from someone using a phone in bright sunlight to someone with an injured arm. In many countries it is a legal requirement for some organisations.</p>
<h2>The principles behind the guidelines</h2>
<p>The Web Content Accessibility Guidelines (WCAG), published by the W3C, are the international reference. They are organised around four principles, often remembered as POUR:</p>
<ul>
<li><strong>Perceivable</strong>: information can be seen or heard in some form, such as text alternatives for images and captions for video.</li>
<li><strong>Operable</strong>: everything works with a keyboard, users have enough time, and nothing flashes in a way that could cause seizures.</li>
<li><strong>Understandable</strong>: text is clear, behaviour is predictable and errors are explained.</li>
<li><strong>Robust</strong>: content works with current and future browsers and assistive technologies, which mostly means valid, semantic HTML.</li>
</ul>
<p>Level AA is the conformance target most commonly used in policies and contracts.</p>
<h2>Common issues and how to avoid them</h2>
<h3>Keyboard access and focus</h3>
<p>Every interactive element must be reachable and usable with the keyboard, in a logical order. Native elements such as <code>&lt;button&gt;</code>, links and form controls do this automatically, while a clickable <code>&lt;div&gt;</code> does not. Never remove focus outlines without a clear replacement; style them with <code>:focus-visible</code> instead.</p>
<h3>Colour and contrast</h3>
<p>At level AA, normal text needs a contrast ratio of at least 4.5:1 against its background, and large text at least 3:1. Do not rely on colour alone to convey meaning, such as marking errors only in red.</p>
<h3>ARIA, used carefully</h3>
<p>ARIA attributes add accessibility information when HTML cannot express it, such as <code>aria-expanded</code> on a menu button. The first rule of ARIA is to use a native HTML element instead whenever one exists, because incorrect ARIA can make a page worse than no ARIA at all.</p>
<h2>A practical testing routine</h2>
<ol>
<li>Run an automated checker such as Lighthouse or the axe browser extension. These tools find only some issues, so treat a clean result as a starting point.</li>
<li>Put your mouse aside and complete key tasks with Tab, Shift+Tab, Enter, Space and the arrow keys, checking that focus is always visible.</li>
<li>Zoom the page to 200% and check that nothing overlaps or disappears.</li>
<li>Check text contrast with the contrast tools in developer tools.</li>
<li>Try a screen reader: VoiceOver on macOS and iOS, Narrator or the free NVDA on Windows, or TalkBack on Android.</li>
</ol>
<h2>Try this</h2>
<p>Run the full routine on the page and form you built in this module. List every issue you find, fix them and test again. Keep the list as a reusable checklist for future projects.</p>$h$));

  -- Module 3
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'CSS layout and responsive design', $t$Style pages with confidence and build layouts that adapt to every screen size.$t$, 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'How CSS works: the cascade, specificity and the box model', $t$Understand the rules that decide which styles apply and how elements take up space.$t$, 'article', 0, 14, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>CSS describes how HTML looks. Writing a rule is easy; understanding why a rule does or does not apply is what turns frustration into confidence. Three concepts explain most CSS behaviour: the cascade, specificity and the box model.</p>
<h2>Rules, selectors and declarations</h2>
<p>A CSS rule pairs a selector with declarations: <code>.card { padding: 1rem; border-radius: 8px; }</code>. Link a stylesheet from your HTML <code>head</code> with <code>&lt;link rel="stylesheet" href="styles.css"&gt;</code>. Common selectors include element names (<code>p</code>), classes (<code>.card</code>), IDs (<code>#main</code>), attributes (<code>[type="email"]</code>), pseudo-classes (<code>:hover</code>, <code>:focus-visible</code>) and combinations such as <code>.card h2</code>.</p>
<h2>The cascade and specificity</h2>
<p>When several rules set the same property on an element, the browser decides which one wins using the cascade. In simplified form, it considers:</p>
<ol>
<li><strong>Origin and importance</strong>: your styles override browser defaults, and declarations marked <code>!important</code> override normal ones.</li>
<li><strong>Specificity</strong>: a more specific selector wins. Inline styles beat IDs, IDs beat classes, attributes and pseudo-classes, and those beat element selectors.</li>
<li><strong>Order</strong>: when specificity is equal, the rule that appears later wins.</li>
</ol>
<p>Some properties, such as <code>color</code> and <code>font-family</code>, are also <strong>inherited</strong> by child elements, which is why setting a font on <code>body</code> affects the whole page.</p>
<p>A practical approach is to style mostly with classes, which keeps specificity low and predictable. Avoid IDs for styling and treat <code>!important</code> as a last resort, because each use makes the next override harder.</p>
<h2>The box model</h2>
<p>Every element is a rectangular box with four layers, from the inside out: content, padding, border and margin. By default, <code>width</code> sets only the content width, so padding and border are added on top, which surprises most beginners. That is why most projects start with this rule:</p>
<p><code>*, *::before, *::after { box-sizing: border-box; }</code></p>
<p>With <code>border-box</code>, the width you set includes padding and border. Also remember that vertical margins between blocks can collapse into a single margin, and that inline elements such as <code>span</code> ignore width and height unless you change their <code>display</code> value.</p>
<h2>Debugging checklist</h2>
<ol>
<li>Inspect the element in developer tools and read the Styles panel, where overridden declarations are crossed out.</li>
<li>Check whether a more specific or later rule is winning.</li>
<li>Use the box model diagram in the Computed panel to see padding, border and margin.</li>
<li>Confirm the selector actually matches, including the spelling of class names.</li>
</ol>
<h2>Try this</h2>
<p>Add a stylesheet to your practice page. Set fonts and colours on <code>body</code>, add the <code>box-sizing</code> rule and style your service cards with padding, a border and margin. Then deliberately write two conflicting rules and use developer tools to explain which one wins and why.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Flexbox for one-dimensional layout', $t$Align and distribute items in a row or a column with flexbox.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Flexbox is a layout method for arranging items in one dimension, either a row or a column. It is ideal for navigation bars, button groups, the inside of cards and centring things, tasks that used to need awkward workarounds.</p>
<h2>Containers and items</h2>
<p>Flexbox works on two levels. You set <code>display: flex</code> on a container, and its direct children become flex items. Items line up along the <strong>main axis</strong>, which runs horizontally by default, while the <strong>cross axis</strong> runs perpendicular to it. Setting <code>flex-direction: column</code> swaps the axes, which is why flexbox properties talk about main and cross rather than horizontal and vertical.</p>
<h2>Key container properties</h2>
<ul>
<li><code>justify-content</code> distributes items along the main axis, with common values <code>flex-start</code>, <code>center</code>, <code>space-between</code> and <code>space-around</code>.</li>
<li><code>align-items</code> aligns items on the cross axis, for example <code>center</code> to centre items vertically in a row.</li>
<li><code>gap</code> sets consistent space between items without margins on the items themselves.</li>
<li><code>flex-wrap: wrap</code> lets items move onto new lines when they run out of space.</li>
</ul>
<p>A typical site header needs one rule: <code>.site-header { display: flex; justify-content: space-between; align-items: center; }</code>. It puts the logo on the left and the navigation on the right, and centres both vertically.</p>
<h2>Controlling item size</h2>
<p>Each item has three sizing properties, usually set together with the <code>flex</code> shorthand:</p>
<ul>
<li><code>flex-grow</code>: how much of the spare space the item takes.</li>
<li><code>flex-shrink</code>: how much the item shrinks when space is short.</li>
<li><code>flex-basis</code>: the starting size before growing or shrinking.</li>
</ul>
<p><code>flex: 1</code> makes items share the space equally. <code>flex: 1 1 15rem</code> means "start at 15rem, then grow or shrink as needed", which combined with <code>flex-wrap: wrap</code> creates a simple responsive row of cards. You can also push one item away from the rest with <code>margin-left: auto</code>, a handy trick for a sign-in button at the end of a menu.</p>
<h2>Flexbox and accessibility</h2>
<p>Properties such as <code>order</code> and <code>flex-direction: row-reverse</code> change the visual order without changing the HTML order. Keyboard and screen reader users follow the HTML order, so a mismatch is confusing. When the sequence matters, change the source order instead.</p>
<h2>Checklist</h2>
<ol>
<li>Is the layout one-dimensional? If items must line up in both rows and columns, consider grid.</li>
<li>Set <code>display: flex</code> on the parent, not on the items.</li>
<li>Use <code>gap</code> for spacing.</li>
<li>Decide whether items should wrap.</li>
<li>Keep the visual order and the source order the same.</li>
</ol>
<h2>Try this</h2>
<p>Build a navigation bar with a logo on the left and four links on the right, and make the links wrap neatly on narrow screens. Next, lay out your three service cards in a row with <code>flex: 1 1 15rem</code> and resize the browser to watch them wrap.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'CSS Grid for two-dimensional layout', $t$Build page layouts and card grids that align in rows and columns.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>CSS Grid controls layout in two dimensions at once: rows and columns. Where flexbox lets content decide its size along one line, grid lets you define a structure first and place content into it. It is the right tool for page layouts, galleries and card grids that must line up.</p>
<h2>Defining a grid</h2>
<p>Set <code>display: grid</code> on a container and describe its columns:</p>
<p><code>.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }</code></p>
<p>The <code>fr</code> unit means a fraction of the available space, so three <code>1fr</code> columns share the width equally. You can mix units, for example <code>grid-template-columns: 16rem 1fr</code> for a fixed sidebar beside a flexible content area. Rows are created automatically as items fill the grid, and <code>gap</code> spaces both rows and columns.</p>
<h2>Responsive grids without media queries</h2>
<p>One declaration creates a grid that adapts to any screen width:</p>
<p><code>grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));</code></p>
<p>This tells the browser to fit as many columns as possible, each at least 16rem wide, and to stretch them to fill the row. On a phone you get one column; on a wide screen, four or more. If the container could be narrower than 16rem on very small screens, use <code>minmax(min(16rem, 100%), 1fr)</code> to prevent overflow.</p>
<h2>Placing items</h2>
<h3>By line numbers</h3>
<p>Grid lines are numbered from 1. <code>grid-column: 1 / -1</code> makes an item span from the first line to the last, which is useful for a full-width banner inside a grid. <code>grid-column: span 2</code> makes an item two columns wide.</p>
<h3>By named areas</h3>
<p>For page layouts, named areas read almost like a diagram. On the container, set <code>grid-template-areas: "header header" "sidebar main" "footer footer";</code> with two matching columns, then assign each child with <code>grid-area: header;</code> and so on. Changing the layout at a breakpoint then means rewriting just that one property.</p>
<h2>Grid or flexbox?</h2>
<ul>
<li>Use grid when items should align in both rows and columns, or when the container defines the layout.</li>
<li>Use flexbox when items flow in a single line and their content determines their size.</li>
<li>Combine them freely: a grid of cards where each card uses flexbox inside is very common.</li>
</ul>
<h2>Checklist</h2>
<ol>
<li>Sketch the rows and columns before writing CSS.</li>
<li>Use <code>fr</code> units and <code>gap</code> rather than percentages and margins.</li>
<li>Try <code>auto-fit</code> with <code>minmax()</code> before adding media queries.</li>
<li>Keep the HTML order logical even when grid places items elsewhere.</li>
</ol>
<h2>Try this</h2>
<p>Rebuild your service cards as a grid using <code>repeat(auto-fit, minmax(16rem, 1fr))</code>, then create a full page layout with a header, sidebar, main content and footer using named areas. Turn on the grid overlay in your browser's developer tools to see the lines and areas.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Responsive design: mobile first, fluid sizing and media queries', $t$Make layouts, text and images adapt gracefully from small phones to large screens.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Your visitors use phones, tablets, laptops and large monitors, in portrait and landscape. Responsive design means one site that adapts to all of them. Modern CSS makes this much easier than it used to be, and much of the work comes from flexible defaults rather than many breakpoints.</p>
<h2>The foundations</h2>
<ul>
<li>Include the viewport meta tag from the HTML module, or mobile browsers will render a zoomed-out desktop layout.</li>
<li>Make media flexible with <code>img, video { max-width: 100%; height: auto; }</code> so they never overflow their container.</li>
<li>Prefer relative units. <code>rem</code> is relative to the root font size and respects the user's browser settings, while percentages and <code>fr</code> adapt to the container.</li>
<li>Limit line length for readability, for example <code>max-width: 65ch</code> on text containers.</li>
</ul>
<h2>Mobile first and media queries</h2>
<p>Mobile first means writing your base styles for small screens, then adding enhancements as space allows with <code>min-width</code> media queries:</p>
<p><code>.layout { display: grid; gap: 1rem; } @media (min-width: 48rem) { .layout { grid-template-columns: 2fr 1fr; } }</code></p>
<p>Small-screen styles are usually simpler, so this approach produces less CSS and fewer overrides. Choose breakpoints where your content starts to look wrong, not around particular devices: resize the browser slowly and add a breakpoint where the layout breaks. Media queries can test more than width, too. <code>prefers-reduced-motion</code> lets you tone down animation for people sensitive to motion, and <code>prefers-color-scheme</code> lets you offer a dark theme.</p>
<h2>Fluid sizing and container queries</h2>
<p>The <code>clamp()</code> function sets a value that scales smoothly between a minimum and a maximum: <code>font-size: clamp(1.75rem, 1.2rem + 2vw, 3rem);</code> gives headings that grow with the screen without any breakpoints. Combined with flexible grids, many layouts need only one or two media queries.</p>
<p>Container queries go a step further: a component responds to the size of its container rather than the whole screen. Set <code>container-type: inline-size</code> on a wrapper, then use <code>@container (min-width: 30rem) { ... }</code> to change a card's layout when it has room. The same component then works in a sidebar and in a wide main column.</p>
<p>For images, <code>srcset</code> and <code>sizes</code> let the browser download the smallest file that still looks sharp, and <code>&lt;picture&gt;</code> lets you serve a different crop on small screens.</p>
<h2>Testing checklist</h2>
<ol>
<li>Test at narrow widths, down to about 320 pixels, and on a real phone.</li>
<li>Check there is no horizontal scrolling.</li>
<li>Check that tap targets are large enough and text is readable without zooming.</li>
<li>Zoom to 200% and confirm the layout still works.</li>
</ol>
<h2>Try this</h2>
<p>Convert your practice page to mobile first. Write base styles for a single column, add one breakpoint for a two-column layout, set fluid heading sizes with <code>clamp()</code>, and test the result in the device toolbar and on your own phone.</p>$h$));

  -- Module 4
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'JavaScript and the DOM', $t$Learn the core language and use it to make pages interactive and data-driven.$t$, 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'JavaScript fundamentals: values, variables and functions', $t$Learn the building blocks of JavaScript that you will use in every script.$t$, 'article', 0, 15, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>JavaScript is the programming language of the browser. HTML gives a page structure, CSS gives it style, and JavaScript gives it behaviour: responding to clicks, validating input, loading data and updating the page. This lesson covers the core language so the following lessons can focus on the browser.</p>
<h2>Running JavaScript</h2>
<p>Load a script from your page's <code>head</code> with <code>&lt;script src="app.js" defer&gt;&lt;/script&gt;</code>. The <code>defer</code> attribute downloads the file without blocking the page and runs it once the HTML has been parsed. You can also experiment directly in the developer tools console, and print values from your code with <code>console.log()</code>.</p>
<h2>Values and variables</h2>
<p>JavaScript has a few basic types: strings such as <code>"hello"</code>, numbers such as <code>42</code> and <code>3.5</code>, booleans (<code>true</code> and <code>false</code>), <code>null</code> for "intentionally empty" and <code>undefined</code> for "not set". Objects and arrays group values together:</p>
<ul>
<li><code>const product = { name: "Tote bag", price: 24 };</code> stores named properties, read with <code>product.name</code>.</li>
<li><code>const sizes = ["S", "M", "L"];</code> stores an ordered list, read with <code>sizes[0]</code>, because arrays start at index 0.</li>
</ul>
<p>Declare variables with <code>const</code> by default and use <code>let</code> only when you need to reassign. Avoid the older <code>var</code>, which has confusing scoping rules. Note that <code>const</code> prevents reassignment, not change: you can still add items to a <code>const</code> array.</p>
<p>Compare values with <code>===</code> and <code>!==</code>, which check both value and type. The looser <code>==</code> converts types first and can produce surprising results.</p>
<h2>Functions and control flow</h2>
<p>Functions package reusable logic. Two forms are common:</p>
<ul>
<li><code>function formatTotal(amount) { return `Total: ${amount.toFixed(2)}`; }</code> is a function declaration. The backtick string is a template literal, which inserts values with <code>${...}</code>.</li>
<li><code>const double = (n) =&gt; n * 2;</code> is an arrow function, handy for short callbacks.</li>
</ul>
<p>Make decisions with <code>if</code> and <code>else</code>, and repeat work with loops. For arrays, the built-in methods are usually clearer than manual loops:</p>
<ul>
<li><code>items.forEach((item) =&gt; console.log(item));</code> runs code for each item.</li>
<li><code>prices.map((p) =&gt; p * 1.2)</code> creates a new array of transformed values.</li>
<li><code>products.filter((p) =&gt; p.inStock)</code> keeps only matching items.</li>
<li><code>products.find((p) =&gt; p.id === 3)</code> returns the first match.</li>
</ul>
<h2>Learning checklist</h2>
<ol>
<li>Use <code>const</code> by default and <code>let</code> when reassigning.</li>
<li>Always compare with <code>===</code>.</li>
<li>Read error messages in the console; they include the file and line number.</li>
<li>Keep functions small and name them after what they do.</li>
</ol>
<h2>Try this</h2>
<p>In the console, create an array of three product objects, each with a name, a price and an <code>inStock</code> flag. Write one function that returns the names of products in stock using <code>filter</code> and <code>map</code>, and another that adds up their prices.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Selecting and changing elements with the DOM', $t$Use the Document Object Model to find, update, create and remove elements.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>When the browser loads your HTML, it builds the Document Object Model, or DOM: a tree of objects representing every element. JavaScript can read and change this tree, and the page updates immediately. This is how scripts show messages, update shopping carts and display data.</p>
<h2>Finding elements</h2>
<ul>
<li><code>document.querySelector(".cart-count")</code> returns the first element matching a CSS selector, or <code>null</code> if nothing matches.</li>
<li><code>document.querySelectorAll(".product")</code> returns a list of all matches, which you can loop over with <code>forEach</code>.</li>
<li><code>document.getElementById("menu")</code> finds an element by its <code>id</code>.</li>
</ul>
<p>Because you already know CSS selectors, you already know how to find elements. Always handle the case where nothing matches; otherwise the next line fails with an error such as "Cannot read properties of null".</p>
<h2>Changing elements</h2>
<h3>Content</h3>
<p>Set text with <code>element.textContent = "3 items";</code>. You will see <code>innerHTML</code> used to insert HTML strings, but never use it with data from users or external sources: it can run injected code, a vulnerability known as cross-site scripting. Use <code>textContent</code> for text and create elements for structure.</p>
<h3>Classes and attributes</h3>
<p>Change appearance by toggling classes rather than setting inline styles, so your CSS stays in control: <code>element.classList.add("is-active")</code>, with <code>remove</code> and <code>toggle</code> working the same way. Read and set attributes with <code>getAttribute</code> and <code>setAttribute</code>, for example to update <code>aria-expanded</code>. Custom <code>data-</code> attributes are available through <code>dataset</code>, so <code>&lt;button data-product-id="12"&gt;</code> gives you <code>button.dataset.productId</code>.</p>
<h2>Creating and removing elements</h2>
<p>Adding a new list item takes three steps:</p>
<ol>
<li>Create it: <code>const item = document.createElement("li");</code></li>
<li>Fill it: <code>item.textContent = product.name;</code></li>
<li>Insert it: <code>list.append(item);</code></li>
</ol>
<p>Remove an element with <code>element.remove()</code>. For repeated structures, a <code>&lt;template&gt;</code> element works as a reusable blueprint that you copy with <code>template.content.cloneNode(true)</code> and fill in.</p>
<p>Your script can only find elements that already exist. Loading it with <code>defer</code>, or with <code>type="module"</code>, which is deferred automatically, guarantees the HTML has been parsed first.</p>
<h2>Checklist</h2>
<ol>
<li>Select elements once and store them in <code>const</code> variables.</li>
<li>Check for <code>null</code> before using a selected element.</li>
<li>Use <code>textContent</code> for text, and never <code>innerHTML</code> with untrusted data.</li>
<li>Toggle classes instead of setting styles directly.</li>
</ol>
<h2>Try this</h2>
<p>Write a script that takes an array of three services and renders each one as a list item inside an empty <code>&lt;ul&gt;</code> on your page, using <code>createElement</code> and <code>textContent</code>. Then add a class to the first item to highlight it.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Handling events and user interaction', $t$Respond to clicks, typing and form submissions with event listeners.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Events are how JavaScript knows something happened: a click, a key press, a form submission or the page finishing loading. You attach event listeners to elements, and your function runs each time the event fires.</p>
<h2>Adding listeners</h2>
<p><code>button.addEventListener("click", (event) =&gt; { ... });</code> registers a function to run on every click. The <code>event</code> object describes what happened: <code>event.target</code> is the element that triggered it, and keyboard events include <code>event.key</code>. Events you will use often include:</p>
<ul>
<li><code>click</code>, which also fires when a focused button is activated with Enter or Space, one more reason to use real buttons.</li>
<li><code>input</code>, which fires as a field's value changes, ideal for live search or character counters.</li>
<li><code>change</code>, which fires when a select, checkbox or field value is committed.</li>
<li><code>submit</code>, which fires on a form when it is submitted by a button or the Enter key.</li>
<li><code>keydown</code>, which fires when a key is pressed.</li>
</ul>
<h2>Handling forms</h2>
<p>To handle a form with JavaScript instead of a full page reload, listen for <code>submit</code> on the form rather than <code>click</code> on the button, so keyboard submission works too. Call <code>event.preventDefault()</code> to stop the default navigation, then read the values with <code>new FormData(form)</code>. Client-side checks are a convenience; the server must still validate everything.</p>
<h2>An accessible menu toggle</h2>
<p>A menu that opens and closes is a classic example:</p>
<ol>
<li>Start with <code>&lt;button type="button" aria-expanded="false" aria-controls="menu"&gt;Menu&lt;/button&gt;</code>.</li>
<li>On click, read the current state: <code>const open = button.getAttribute("aria-expanded") === "true";</code></li>
<li>Flip it: <code>button.setAttribute("aria-expanded", String(!open));</code></li>
<li>Show or hide the menu to match: <code>menu.hidden = open;</code></li>
</ol>
<p>Because it is a real button with <code>aria-expanded</code>, keyboard and screen reader users get the same experience as mouse users.</p>
<h2>Event delegation</h2>
<p>Events bubble up from the element where they happen through its ancestors. Instead of adding a listener to every item in a long or changing list, add one listener to the parent and check what was clicked:</p>
<p><code>list.addEventListener("click", (event) =&gt; { const button = event.target.closest("button[data-id]"); if (!button) return; removeItem(button.dataset.id); });</code></p>
<p>This also works for items added later, and keeps your code simpler.</p>
<h2>Checklist</h2>
<ol>
<li>Use <code>&lt;button&gt;</code> for actions and links for navigation.</li>
<li>Listen for <code>submit</code> on forms.</li>
<li>Update ARIA state such as <code>aria-expanded</code> together with the visuals.</li>
<li>Use delegation for lists.</li>
</ol>
<h2>Try this</h2>
<p>Add a mobile menu toggle to your practice page using the steps above. Then add a live character counter below your contact form's message field that updates on every <code>input</code> event, and test both using only the keyboard.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Fetching data from APIs', $t$Load JSON from an API with fetch and async/await, and handle loading and errors.$t$, 'article', 3, 15, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Many websites display data that lives elsewhere: products, opening hours, weather or prices. Applications share that data through APIs, usually as JSON over HTTP. In this lesson you will load data with the built-in <code>fetch</code> function and display it safely.</p>
<h2>JSON and APIs</h2>
<p>JSON, short for JavaScript Object Notation, is a text format that looks like JavaScript objects and arrays: <code>{ "id": 1, "name": "Tote bag", "price": 24 }</code>. A web API is a set of URLs, often called endpoints, that return or accept JSON. Its documentation tells you the URLs, the parameters and whether you need a key.</p>
<h2>Asynchronous code</h2>
<p>Network requests take time, and JavaScript does not freeze the page while it waits. <code>fetch</code> returns a <strong>promise</strong>, an object representing a value that will arrive later. The clearest way to work with promises is <code>async</code> and <code>await</code>:</p>
<p><code>async function loadProducts() { const response = await fetch("/data/products.json"); if (!response.ok) { throw new Error(`Request failed: ${response.status}`); } return response.json(); }</code></p>
<p>Note the <code>response.ok</code> check. <code>fetch</code> only rejects its promise when the network fails; a 404 or 500 response still counts as a completed request, so you must check the status yourself. <code>response.json()</code> then parses the body.</p>
<h2>Handling every state</h2>
<p>A data-driven component has three states, and users should see each one:</p>
<ul>
<li><strong>Loading</strong>: show a message or placeholder while waiting.</li>
<li><strong>Success</strong>: render the data with <code>textContent</code> or created elements rather than raw HTML.</li>
<li><strong>Error</strong>: show a helpful message and, where sensible, a retry button.</li>
</ul>
<p>Wrap the call in <code>try</code>, <code>catch</code> and <code>finally</code>: render in <code>try</code>, show the error in <code>catch</code> and hide the loading indicator in <code>finally</code>. Placing status messages in an element with <code>aria-live="polite"</code> lets screen readers announce changes.</p>
<h2>Sending data and common pitfalls</h2>
<p>To send data, pass options: <code>fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })</code>.</p>
<p>Two problems catch everyone eventually. <strong>CORS</strong>: browsers block reading responses from another domain unless that server allows it with an <code>Access-Control-Allow-Origin</code> header, which is controlled by the API, not by your code. <strong>Secret keys</strong>: anything in front-end JavaScript is visible to visitors, so never put private API keys there; call such APIs from a server or serverless function instead.</p>
<h2>Checklist</h2>
<ol>
<li>Read the API documentation for URLs, parameters and limits.</li>
<li>Check <code>response.ok</code> before parsing.</li>
<li>Show loading, success and error states.</li>
<li>Insert data with <code>textContent</code>.</li>
<li>Keep secret keys off the front end.</li>
</ol>
<h2>Try this</h2>
<p>Create a <code>data/products.json</code> file with four products, then fetch it and render the products as cards. Serve the folder with a local development server, such as <code>npx serve</code>, because browsers block <code>fetch</code> for files opened directly from disk. Finally, rename the file to trigger an error and check that your page shows a friendly message.</p>$h$));

  -- Module 5
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Frameworks and deployment', $t$See how modern frameworks fit in, put your site online and prove your skills.$t$, 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Modern frameworks and build tools: what they solve', $t$Understand components, state and rendering so you can choose tools with confidence.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Job adverts and tutorials mention React, Vue, Svelte, Angular, Next.js, Astro and many more. The list can look overwhelming, but these tools share a small set of ideas built on the HTML, CSS and JavaScript you already know. This lesson explains what they solve and how to decide whether you need one.</p>
<h2>The problem frameworks solve</h2>
<p>In the previous module you updated the DOM by hand: find an element, change its text, add a class, append a child. That works well for small features. As an interface grows, keeping the screen in sync with changing data becomes hard to manage, and bugs appear whenever one update is forgotten.</p>
<p>Front-end frameworks take a <strong>declarative</strong> approach. You describe what the interface should look like for given data, and the framework updates the DOM when the data changes. Three ideas appear in all of them:</p>
<ul>
<li><strong>Components</strong>: reusable pieces of interface, such as a product card, that combine markup, logic and often styles.</li>
<li><strong>Props</strong>: inputs passed into a component, such as the product it should display.</li>
<li><strong>State</strong>: data that changes over time, such as the items in a cart. When state changes, the affected components re-render.</li>
</ul>
<h2>Meta-frameworks and rendering</h2>
<p>Meta-frameworks such as Next.js (built on React), Nuxt (Vue), SvelteKit (Svelte) and Astro add routing, data loading and a choice of rendering strategies:</p>
<ul>
<li><strong>Static generation</strong>: pages are built into HTML ahead of time. It is fast and cheap to host, and ideal for content that changes rarely.</li>
<li><strong>Server-side rendering</strong>: HTML is generated on each request, which suits personalised or frequently changing pages.</li>
<li><strong>Client-side rendering</strong>: the browser receives minimal HTML and JavaScript builds the page. This suits highly interactive apps behind a login, but content can take longer to appear.</li>
</ul>
<h2>Build tools and packages</h2>
<p>Frameworks rely on tooling. <code>npm</code> installs the packages listed in <code>package.json</code>. A build tool such as Vite runs a development server that reloads instantly as you edit, and for production it bundles and minifies your code. Most projects start with a single command, such as <code>npm create vite@latest</code>, followed by <code>npm install</code> and <code>npm run dev</code>.</p>
<h2>Do you need a framework?</h2>
<ol>
<li>For a brochure site, landing page or blog, plain HTML and CSS, a static site generator or a content management system is often simpler and faster.</li>
<li>For an interface with lots of changing state, such as a dashboard or a booking flow, a framework usually pays for itself.</li>
<li>If you join a team, use what the team uses; the concepts transfer between frameworks.</li>
<li>Whatever you choose, the fundamentals still apply. Semantic HTML, accessible interactions and responsive CSS remain your responsibility in every framework.</li>
</ol>
<h2>Try this</h2>
<p>Pick one framework and complete the first section of its official tutorial. As you go, note where you see components, props and state, and compare the HTML it generates in the browser with what you would have written by hand.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Deploying your site to the web', $t$Put your site online with HTTPS, a custom domain and a repeatable deployment process.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A site only creates value when people can reach it. Deploying used to mean copying files to a server by hand; today, most front-end projects deploy automatically from a Git repository. This lesson walks you through the process and what to check afterwards.</p>
<h2>Choosing hosting</h2>
<ul>
<li><strong>Static hosting</strong> serves HTML, CSS, JavaScript and images as files. It suits everything you have built in this course, and providers such as GitHub Pages, Netlify, Vercel and Cloudflare Pages offer free tiers for small projects.</li>
<li><strong>Platforms with server functions</strong> also run back-end code, such as server-side rendering or API routes, which many framework projects need.</li>
<li><strong>Virtual servers</strong> give you full control but make you responsible for the operating system, security updates and web server configuration.</li>
</ul>
<p>Start with static hosting unless your project needs a server. Check a provider's current pricing and limits before relying on a free plan for a business.</p>
<h2>Deploying from Git</h2>
<ol>
<li>Push your project to a Git hosting service.</li>
<li>Create a new site with your hosting provider and connect the repository.</li>
<li>Set the build command, such as <code>npm run build</code>, and the output folder, such as <code>dist</code>. For plain HTML, leave the build command empty and publish the project folder.</li>
<li>Add environment variables in the provider's dashboard rather than in your code.</li>
<li>Deploy. Each push to the main branch now redeploys the site, and many providers create preview deployments for other branches so you can review changes before merging.</li>
</ol>
<h2>Domains and HTTPS</h2>
<p>Your site gets a subdomain from the provider by default. To use your own domain, register it with a domain registrar, then add the DNS records your host specifies, usually an <code>A</code> record for the root domain or a <code>CNAME</code> record for a subdomain such as <code>www</code>. DNS changes can take a while to spread. Most hosts then issue a free TLS certificate automatically, so your site is served over HTTPS. Make sure plain HTTP redirects to HTTPS, and choose one main address, with or without <code>www</code>, that the other redirects to.</p>
<h2>After you launch</h2>
<ul>
<li>Run Lighthouse on the live site and fix major performance and accessibility issues.</li>
<li>Test on real phones and in at least two different browsers.</li>
<li>Check that your custom 404 page works and that every link resolves.</li>
<li>Register the site with a search engine's webmaster tools, such as Google Search Console, to see indexing problems.</li>
<li>Remember that environment variables used in front-end code end up visible to visitors, so keep real secrets on a server.</li>
</ul>
<h2>Try this</h2>
<p>Deploy your practice site from its Git repository to a static host. Make a small change, push it and watch the site redeploy automatically. If you own a domain, connect it and confirm the site loads over HTTPS without any browser warnings.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What does the Domain Name System (DNS) do when you visit a website?$t$, $t$DNS translates a host name such as shop.example.com into the IP address of the server, so the browser knows where to connect. Encryption is handled by TLS and rendering by the browser.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$It translates the domain name into the server's IP address$t$, true, 0), (qq, $t$It encrypts the connection between browser and server$t$, false, 1), (qq, $t$It renders the HTML into pixels$t$, false, 2), (qq, $t$It stores the website's cookies$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which file tells Git not to track files such as node_modules or files containing secrets?$t$, $t$A .gitignore file lists paths and patterns that Git should not track. package.json lists project dependencies, and README.md documents the project.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$.gitignore$t$, true, 0), (qq, $t$package.json$t$, false, 1), (qq, $t$README.md$t$, false, 2), (qq, $t$index.html$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$A response with a 500 status code usually means the problem is on the server rather than in the request.$t$, $t$True. 5xx codes are server errors, so you should check the server and its logs. 4xx codes such as 404 indicate a problem with the request.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, true, 0), (qq, $t$False$t$, false, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which element should wrap the main content of a page, used once per page?$t$, $t$The main element marks the primary content and creates a landmark that assistive technology users can jump to. section and article group content but can appear many times, and a div has no meaning.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The main element$t$, true, 0), (qq, $t$The section element$t$, false, 1), (qq, $t$A div with an id of content$t$, false, 2), (qq, $t$The aside element$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which practices make a form more accessible? Select all that apply.$t$, $t$Visible labels linked with for and id, error messages in text next to the field, and fieldsets with legends for related options all help. Placeholders disappear when typing, and colour alone is not perceivable by everyone.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$A visible label connected to its input with matching for and id values$t$, true, 0), (qq, $t$Error messages written in text next to the field$t$, true, 1), (qq, $t$Grouping related radio buttons in a fieldset with a legend$t$, true, 2), (qq, $t$Using placeholder text instead of labels$t$, false, 3), (qq, $t$Showing errors only by turning the border red$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which CSS declaration makes an element's width include its padding and border?$t$, $t$box-sizing: border-box includes padding and border in the width you set. The default, content-box, adds them on top of the content width.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$box-sizing: border-box$t$, true, 0), (qq, $t$box-sizing: content-box$t$, false, 1), (qq, $t$display: block$t$, false, 2), (qq, $t$margin: 0 auto$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$You want a card grid that fits as many columns of at least 16rem as the screen allows, without media queries. Which declaration does this?$t$, $t$repeat(auto-fit, minmax(16rem, 1fr)) creates as many columns as fit, each at least 16rem wide and stretched to fill the row, so the grid adapts to any width.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr))$t$, true, 0), (qq, $t$grid-template-columns: 16rem$t$, false, 1), (qq, $t$flex-direction: column$t$, false, 2), (qq, $t$float: left$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which statements about fetch are correct? Select all that apply.$t$, $t$fetch returns a promise and only rejects on network failure, so you must check response.ok for errors such as 404 or 500. Anything in front-end code, minified or not, is visible to visitors, so private keys never belong there.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$fetch returns a promise$t$, true, 0), (qq, $t$You should check response.ok, because 404 and 500 responses do not reject the promise$t$, true, 1), (qq, $t$fetch automatically throws an error for every status other than 200$t$, false, 2), (qq, $t$Private API keys are safe in front-end code once the file is minified$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$Setting innerHTML to text submitted by users is a safe way to display it on the page.$t$, $t$False. innerHTML parses the string as HTML, so injected markup can run code, a vulnerability called cross-site scripting. Use textContent for user-supplied text.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$True$t$, false, 0), (qq, $t$False$t$, true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which rendering approach builds pages into HTML ahead of time, making them fast and cheap to host?$t$, $t$Static generation produces HTML files at build time, which any static host can serve quickly. Server-side rendering builds HTML on each request, and client-side rendering builds the page in the browser.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Static generation$t$, true, 0), (qq, $t$Server-side rendering on every request$t$, false, 1), (qq, $t$Client-side rendering$t$, false, 2), (qq, $t$Inline styles$t$, false, 3);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$Ten questions covering how the web works, Git, semantic HTML and accessibility, CSS layout, JavaScript and APIs, and frameworks. You need 70% to pass, and you can review the correct answers with explanations after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'Build and deploy an accessible, responsive one-page website', $h$<p>Bring everything together by building and publishing a small but complete website: a one-page site for a real or fictional small business, product or personal portfolio. Use plain HTML, CSS and JavaScript without a framework, so every line is your own work.</p>
<h2>Requirements</h2>
<h3>Structure and accessibility</h3>
<ul>
<li>Semantic landmarks (<code>header</code>, <code>nav</code>, <code>main</code> and <code>footer</code>) and a logical heading outline with a single <code>h1</code>.</li>
<li>Meaningful <code>alt</code> text on every informative image and an empty <code>alt</code> on decorative ones.</li>
<li>A contact or sign-up form with labelled fields, suitable input types and clear validation messages.</li>
<li>Everything usable with the keyboard alone, with visible focus styles and sufficient colour contrast.</li>
</ul>
<h3>Layout</h3>
<ul>
<li>Mobile-first CSS that works from about 320 pixels wide up to large desktop screens without horizontal scrolling.</li>
<li>At least one flexbox layout, such as the navigation, and one grid layout, such as a card section.</li>
<li>Fluid typography or spacing using relative units or <code>clamp()</code>.</li>
</ul>
<h3>JavaScript</h3>
<ul>
<li>An accessible interactive feature, such as a mobile menu toggle that updates <code>aria-expanded</code>.</li>
<li>Content loaded with <code>fetch</code> from a local JSON file or a public API that needs no secret key, with loading and error states, rendered with <code>textContent</code> or created elements.</li>
</ul>
<h3>Workflow and deployment</h3>
<ul>
<li>A Git repository with at least five meaningful commits and a <code>.gitignore</code> file.</li>
<li>The site deployed to a public URL served over HTTPS.</li>
</ul>
<h2>What to submit</h2>
<ol>
<li>The live URL and the repository URL.</li>
<li>A short write-up of 300 to 500 words explaining your layout decisions, how you tested accessibility, and one problem you solved along the way.</li>
<li>A screenshot or export of a Lighthouse report for the live site.</li>
</ol>
<p>Use only text and images you have the right to publish, and do not include other people's personal information.</p>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion',$t$Semantic HTML and accessibility$t$,'description',$t$Correct landmarks and heading outline, meaningful alt text, labelled form controls, full keyboard support, visible focus and adequate contrast.$t$,'points',30),
        jsonb_build_object('id','c2','criterion',$t$Responsive CSS layout$t$,'description',$t$Mobile-first styles, appropriate use of flexbox and grid, fluid sizing, and no overflow or broken layouts from small phones to wide screens.$t$,'points',25),
        jsonb_build_object('id','c3','criterion',$t$JavaScript and data$t$,'description',$t$The interactive feature works for mouse, keyboard and screen reader users, and fetched data handles loading and error states and is rendered safely.$t$,'points',25),
        jsonb_build_object('id','c4','criterion',$t$Git workflow and deployment$t$,'description',$t$A clear commit history, a sensible .gitignore, a live HTTPS deployment and a write-up that explains decisions and testing.$t$,'points',20)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', $t$Build, test and deploy an accessible, responsive one-page website.$t$, 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Apply everything from the course by building and publishing a small website of your own. Review the requirements and the rubric first, then plan your page on paper before you write any code.$t$));
end $$;
