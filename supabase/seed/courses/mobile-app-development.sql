-- Foremint Academy course content: Mobile App Development
do $$
declare
  c uuid; m uuid; l uuid; qz uuid; qq uuid; asg uuid;
begin
  select id into c from public.courses where slug = 'mobile-app-development';
  if c is null then raise exception 'course not found'; end if;
  if exists (select 1 from public.course_modules where course_id = c) then
    raise notice 'already seeded'; return;
  end if;

  update public.courses set
    title = 'Mobile App Development',
    short_description = $t$Plan, build and publish your first mobile app. Choose between native and cross-platform, design a usable mobile experience, build screens, navigation and data, test properly, and ship to the App Store and Google Play with a plan for improving after launch.$t$,
    description = $h$<p>Building a mobile app can feel overwhelming: two major platforms, many frameworks, design rules, app store policies and a long list of things that can go wrong. This course gives you a clear path from idea to published app, focusing on the decisions and skills that matter most for a first release.</p>
<h2>What you will learn</h2>
<ul>
<li><strong>Planning</strong> – how apps reach users, how to choose between native and cross-platform development, how to define a focused minimum viable product and how to set up your tools.</li>
<li><strong>Designing for mobile</strong> – mobile UX principles, user flows, wireframes, platform conventions and accessibility.</li>
<li><strong>Core building blocks</strong> – components and screens, navigation patterns, state management and forms.</li>
<li><strong>Data, quality and release preparation</strong> – calling APIs, storing data on the device securely, testing on simulators, emulators and real devices, and preparing for store review.</li>
<li><strong>Publishing and growth</strong> – submitting to the Apple App Store and Google Play, then improving your app with analytics, crash reports and user feedback.</li>
</ul>
<h2>Framework-neutral, with concrete examples</h2>
<p>The concepts apply whether you build natively in Swift and Kotlin or use a cross-platform framework. To keep things concrete, code examples use React Native with Expo and are clearly labelled "Example (React Native)", with notes on Flutter equivalents where helpful. You can follow along in whichever framework you choose.</p>
<h2>How the course works</h2>
<p>Each lesson is a focused article with a practical checklist and a short "Try this" task that moves your own app forward. By the end you will have a product specification, user flows, a prototype, a testing plan and a release checklist. A course quiz checks your understanding, and a practical assignment lets you bring everything together for feedback.</p>
<h2>A note on store rules</h2>
<p>Apple and Google update their policies, fees and technical requirements regularly. This course teaches the underlying principles and shows you where to find the official guidance, so you always work from the current rules rather than outdated numbers.</p>$h$,
    learning_outcomes = array[
      $t$Compare native and cross-platform approaches and choose one for your project$t$,
      $t$Define a focused minimum viable product with clear user flows$t$,
      $t$Design mobile screens that follow platform conventions and accessibility basics$t$,
      $t$Build screens, navigation, state and forms in a cross-platform framework$t$,
      $t$Fetch data from APIs and store data safely on the device$t$,
      $t$Test your app on simulators, emulators and real devices$t$,
      $t$Prepare store listings, privacy details and builds for both app stores$t$,
      $t$Plan post-launch updates using analytics, crash reports and feedback$t$
    ],
    requirements = array[
      $t$Basic computer skills and a willingness to work with code$t$,
      $t$Some familiarity with any programming language; JavaScript basics make the examples easier$t$,
      $t$A computer that can run current development tools (some iOS build steps need a Mac)$t$,
      $t$An Android phone or iPhone for testing is recommended but not essential$t$
    ],
    target_audience = array[
      $t$Entrepreneurs who want to plan and validate an app idea$t$,
      $t$Web developers moving into mobile development$t$,
      $t$Freelancers who want to offer app development services$t$,
      $t$Beginners who want a structured path to their first published app$t$
    ],
    tags = array['mobile-development','app-development','react-native','ios','android','app-store','google-play','mobile-ux'],
    level = 'beginner',
    estimated_duration_minutes = 266,
    sequential_progression = false,
    certificate_enabled = true, certificate_min_progress = 100,
    certificate_require_quizzes = true, certificate_require_assignments = false,
    discussions_enabled = true,
    status = 'published', visibility = 'public', published_at = now(),
    seo_title = $t$Mobile App Development: build and publish your first app$t$,
    seo_description = $t$Plan, build, test and publish your first mobile app: native vs cross-platform, mobile UX, APIs, storage and releasing to the App Store and Google Play.$t$
  where id = c;

  -- Module 1
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Planning your first app', $t$Understand the mobile landscape, choose your technical approach, define a focused first version and set up your tools.$t$, 0) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'How mobile apps reach users: platforms, stores and devices', $t$The platforms, distribution channels and device constraints that shape every mobile app.$t$, 'article', 0, 10, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Before you write a line of code, it helps to understand the environment your app will live in. A mobile app runs on a device you do not control, is distributed through a store with its own rules, and competes for attention with everything else on someone's phone. Knowing these constraints early saves you from expensive surprises later.</p>
<h2>Two major platforms</h2>
<p>Most smartphones run one of two operating systems: Apple's <strong>iOS</strong> (and iPadOS on tablets) and Google's <strong>Android</strong>. They differ in important ways:</p>
<ul>
<li><strong>Languages and tools.</strong> Native iOS apps are typically written in Swift using Xcode, which runs on macOS. Native Android apps are typically written in Kotlin using Android Studio.</li>
<li><strong>Design conventions.</strong> Apple publishes the Human Interface Guidelines, and Android apps generally follow Material Design. Users expect apps to feel at home on their platform.</li>
<li><strong>Device variety.</strong> Apple makes a relatively small range of devices. Android runs on many devices from many manufacturers, with varied screen sizes, hardware and OS versions.</li>
<li><strong>Audience.</strong> The share of each platform varies widely by country and customer group, so research your own target market rather than assuming.</li>
</ul>
<h2>How apps are distributed</h2>
<p>On iPhone, public apps are distributed mainly through the <strong>App Store</strong>, managed in App Store Connect. On Android, the main channel is <strong>Google Play</strong>, managed in the Play Console. Both require a developer account, review apps against published policies and take a commission on some sales. Rules about alternative distribution and payment options differ by region and keep changing, so check the current official documentation for the markets you target.</p>
<h2>Constraints that shape mobile apps</h2>
<ul>
<li><strong>Small screens and touch input</strong> – fewer elements fit, and fingers are less precise than a mouse pointer.</li>
<li><strong>Unreliable connections</strong> – users move between Wi-Fi, mobile data and no signal.</li>
<li><strong>Battery and memory</strong> – the operating system may pause or close your app in the background.</li>
<li><strong>Permissions and privacy</strong> – the camera, location, contacts and notifications all need the user's permission.</li>
<li><strong>Slower updates</strong> – each new version may need store review, and not every user updates straight away.</li>
</ul>
<h2>Questions to answer before you start</h2>
<ol>
<li>Which platforms do your target users mainly use?</li>
<li>Does your idea need to be an app, or would a mobile-friendly website work?</li>
<li>Which device features, such as camera, location or notifications, does it truly need?</li>
<li>Must it work offline, or only with a connection?</li>
<li>How will it make money, if at all?</li>
</ol>
<h3>Try this</h3>
<p>Write a half-page "app context" note for your idea that answers the five questions above. Where you are unsure, write down how you could find out, for example by asking ten potential users which phone they use.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Native or cross-platform: choosing your approach', $t$Compare native, cross-platform and web-based options and pick the right one for your first app.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>One of the first technical decisions you face is how to build the app. There is no single right answer. The best choice depends on what your app needs to do, your skills, your budget and who will maintain it.</p>
<h2>The main approaches</h2>
<h3>Native development</h3>
<p>You build a separate app for each platform with its own language and tools: Swift and Xcode for iOS, Kotlin and Android Studio for Android. You get full, immediate access to every platform feature and the platform's own interface components. The trade-off is maintaining two codebases, often requiring two sets of skills.</p>
<h3>Cross-platform frameworks</h3>
<p>You write most of the code once and ship it to both platforms. Popular options include:</p>
<ul>
<li><strong>React Native</strong> – uses JavaScript or TypeScript with React and renders native interface components. It is often used with Expo, a toolkit that simplifies setup, builds and updates.</li>
<li><strong>Flutter</strong> – uses the Dart language and draws its own interface with a rendering engine, giving consistent visuals across platforms.</li>
<li><strong>Kotlin Multiplatform</strong> – shares business logic written in Kotlin while allowing native interfaces on each platform.</li>
</ul>
<p>Cross-platform tools cover most common needs and can call native code when required, but brand-new platform features or specialised hardware integrations may need extra native work.</p>
<h3>Web-based options</h3>
<p>A progressive web app (PWA) runs in the browser and can be added to the home screen. It needs no store review, but its access to device features and its visibility in app stores are more limited, particularly on iOS.</p>
<h2>How to decide</h2>
<ul>
<li><strong>Need both platforms with a small team?</strong> Cross-platform is usually the efficient choice.</li>
<li><strong>Relying on cutting-edge platform features, advanced graphics or tight hardware integration?</strong> Native may be worth the extra effort.</li>
<li><strong>What skills do you have?</strong> A web developer who knows JavaScript can become productive in React Native quickly; a team with Android experience may prefer Kotlin.</li>
<li><strong>Validating an idea?</strong> Choose whatever lets you ship a quality first version fastest, so you can learn from real users.</li>
</ul>
<blockquote>Users judge your app by whether it is fast, reliable and useful, not by the technology behind it.</blockquote>
<h2>The approach used in this course</h2>
<p>The concepts in this course apply to every approach. Where a concrete example helps, we use <strong>React Native with Expo</strong> and label it "Example (React Native)". If you choose Flutter or native development, the same ideas apply with different syntax, and each framework's official documentation shows the equivalent.</p>
<h3>Decision checklist</h3>
<ol>
<li>List the device features your first version needs.</li>
<li>Check that your preferred framework supports each one through maintained libraries.</li>
<li>Consider who will maintain the app in a year.</li>
<li>Write down your choice and the two main reasons for it.</li>
</ol>
<h3>Try this</h3>
<p>Complete the decision checklist using your app context note and record your chosen approach. If you are torn, build a tiny "hello world" screen in two frameworks and see which feels clearer to you.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Defining your minimum viable product', $t$Turn an idea into a focused first version with a clear problem, user and feature list.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Many first apps struggle not because of poor code but because they try to do too much, or solve a problem nobody has. Defining a focused first version, often called a minimum viable product or MVP, lets you launch sooner, learn from real users and spend your effort where it matters.</p>
<h2>Start with the problem, not features</h2>
<p>Write a single problem statement in the form: <em>"[Type of user] needs a way to [do something] because [reason]."</em> For example: "Independent dog walkers need a way to log walks and share updates with owners because texting photos and notes is messy and easy to lose." Keep it about the user's problem, not your solution.</p>
<h3>Validate before you build</h3>
<ul>
<li>Talk to five to ten people in your target group about how they handle the problem today.</li>
<li>Look at existing apps in the stores and read their reviews, especially the complaints, to find gaps.</li>
<li>Test interest with a simple landing page or a clickable prototype before writing code.</li>
</ul>
<p>Pay more attention to what people already do and pay for than to what they say they might use.</p>
<h2>Define your user and their key tasks</h2>
<p>Describe one primary user in a short paragraph: who they are, their context and their goal. Then list the core tasks they must be able to complete. For the dog-walking example: add a client, start and end a walk, attach a photo and note, and send a summary to the owner.</p>
<h2>Prioritise ruthlessly</h2>
<p>List every feature idea, then sort them with a simple method such as <strong>MoSCoW</strong>:</p>
<ul>
<li><strong>Must have</strong> – without it, the core task is impossible.</li>
<li><strong>Should have</strong> – important, but the app works without it.</li>
<li><strong>Could have</strong> – nice extras.</li>
<li><strong>Won't have (this time)</strong> – explicitly out of scope for version one.</li>
</ul>
<p>Your MVP is the must-haves, built well. Common candidates for "won't have" in a first version include social features, complex settings, multiple user roles and support for every possible device type.</p>
<h2>Write a one-page product spec</h2>
<ol>
<li>Problem statement and primary user.</li>
<li>Core tasks, in the order a user would complete them.</li>
<li>Must-have features, each linked to a task.</li>
<li>Platforms and devices for the first release.</li>
<li>Data the app needs: what is stored, where, and whether it is personal.</li>
<li>Success measures, such as how many users complete the core task each week.</li>
<li>An out-of-scope list.</li>
</ol>
<blockquote>If a feature does not help a user complete a core task, it can usually wait.</blockquote>
<h3>Try this</h3>
<p>Write the one-page spec for your app. Then remove one more feature from the must-have list and ask whether the app still solves the problem. If it does, move that feature to "should have".</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Setting up your development environment', $t$Install the tools you need and run an app on a simulator, an emulator and a real device.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A working development environment lets you write code, run it on a simulated or real device and see changes quickly. Setup is where many beginners get stuck, so take it slowly and follow the official guides for your chosen tools, which are kept up to date as versions change.</p>
<h2>What every mobile setup needs</h2>
<ul>
<li><strong>A code editor</strong>, such as Visual Studio Code, or a full IDE such as Android Studio or Xcode.</li>
<li><strong>A runtime and SDK</strong> for your approach, for example Node.js for React Native, the Flutter SDK for Flutter, or the platform SDKs for native work.</li>
<li><strong>Somewhere to run the app</strong>: an iOS Simulator, an Android Emulator or a physical device.</li>
<li><strong>Version control</strong>, usually Git, so you can track changes and undo mistakes.</li>
</ul>
<h2>Simulators, emulators and real devices</h2>
<p>The <strong>iOS Simulator</strong> comes with Xcode and runs only on macOS. The <strong>Android Emulator</strong> comes with Android Studio and runs on Windows, macOS and Linux. Both are fast for everyday work, but neither perfectly reproduces real hardware: performance, camera, sensors, notifications and touch can all differ. Test on at least one real device for each platform you support before release.</p>
<h3>A note on iOS builds</h3>
<p>Building and signing iOS apps traditionally requires a Mac with Xcode. Some cross-platform toolchains offer cloud build services that produce iOS builds without a local Mac, though you still need an Apple Developer account to distribute the app. Check your framework's documentation for current options.</p>
<h2>Example (React Native)</h2>
<p>With Expo, a typical start looks like this. Treat the commands as illustrations and follow the current Expo documentation for exact steps:</p>
<ol>
<li>Install a supported version of Node.js.</li>
<li>Create a project with <code>npx create-expo-app@latest my-app</code>.</li>
<li>Run <code>cd my-app</code>, then start the development server with <code>npx expo start</code>.</li>
<li>Open the project on your phone with the Expo Go app, or use the keyboard shortcuts shown in the terminal to open a simulator or emulator.</li>
<li>Edit a file and save it. The app should reload with your change within seconds.</li>
</ol>
<p>In Flutter, the equivalent commands are <code>flutter create</code> and <code>flutter run</code>, and <code>flutter doctor</code> checks your setup.</p>
<h2>Good habits from day one</h2>
<ul>
<li>Initialise a Git repository and commit after each working change.</li>
<li>Keep secrets such as API keys out of your repository.</li>
<li>Record your tool versions in a README so you can recreate the setup later.</li>
<li>When something fails, read the whole error message before searching; it often names the fix.</li>
</ul>
<h3>Setup checklist</h3>
<ol>
<li>Editor installed and working.</li>
<li>Framework or SDK installed, and its setup check passes.</li>
<li>App runs in at least one simulator or emulator.</li>
<li>App runs on at least one physical device.</li>
<li>Project committed to Git.</li>
</ol>
<h3>Try this</h3>
<p>Create a new project, run it on a simulator or emulator and on your own phone, then change the text on the first screen to your app's name and commit the result.</p>$h$));

  -- Module 2
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Designing for mobile', $t$Turn your product spec into user flows and screens that feel natural, follow platform conventions and work for everyone.$t$, 1) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Mobile UX principles: context, thumbs and attention', $t$Design for how people really use phones: in short bursts, on the move and often one-handed.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Designing for a phone is different from designing for a desktop browser. People use apps in short bursts, on the move, often with one hand and while distracted. Good mobile user experience (UX) accepts these conditions and designs for them.</p>
<h2>Design for context</h2>
<p>Think about where and how your users will open the app. A dog walker logging a walk is outdoors, holding a lead and has seconds to spare. That suggests large buttons, minimal typing and a clear primary action on the first screen. Write down two or three typical situations for your primary user and design for those, not for someone sitting calmly at a desk.</p>
<h2>Core principles</h2>
<h3>Focus each screen on one main job</h3>
<p>Every screen should have a clear purpose and an obvious primary action. If a screen is trying to do three things, split it or move secondary actions out of the way.</p>
<h3>Make targets easy to tap</h3>
<p>Fingers are imprecise. Apple and Google both publish minimum recommended touch target sizes in their design guidelines; follow them and leave space between targets. Place frequent actions where thumbs reach easily, generally towards the lower part of the screen on large phones.</p>
<h3>Reduce typing</h3>
<p>Typing on a phone is slow and error-prone. Use sensible defaults, pickers, toggles and autofill, and choose the right keyboard for each field, such as numeric for amounts and email for addresses.</p>
<h3>Give immediate feedback</h3>
<p>Every tap should produce a visible response: a pressed state, a loading indicator or a confirmation. Silence makes users tap again or assume the app is broken.</p>
<h3>Respect attention</h3>
<p>Ask for permissions only when the user needs the feature, and explain why first. Send notifications only when they are genuinely useful. Interruptions that feel pushy are a common reason people uninstall apps.</p>
<h2>Content and layout</h2>
<ul>
<li>Use short, clear labels and plain language.</li>
<li>Create visual hierarchy with size, weight and spacing rather than many colours.</li>
<li>Design for different screen sizes, including small phones, and tablets if you support them.</li>
<li>Support the system text size setting so your layout still works with larger text.</li>
<li>Plan empty states, such as "No walks yet", with a helpful next step.</li>
</ul>
<h2>UX review checklist</h2>
<ol>
<li>Can a new user tell what the app does within a few seconds?</li>
<li>Does each screen have one clear primary action?</li>
<li>Can the core task be completed with one hand?</li>
<li>Is typing kept to a minimum?</li>
<li>Does every action give feedback?</li>
</ol>
<h3>Try this</h3>
<p>Open two apps you use daily and complete a common task in each. Note three things that make them feel easy or frustrating, and add one idea from each to your own design notes.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'User flows, wireframes and prototypes', $t$Map each core task step by step, sketch the screens and test them before writing code.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>A user flow maps the steps someone takes to complete a task in your app. A wireframe is a simple sketch of a screen that shows layout and content without colour or polish. Together they let you test ideas cheaply, before any code exists, when changes take minutes instead of days.</p>
<h2>Mapping user flows</h2>
<p>Take each core task from your product spec and write it as a sequence of steps, from opening the app to finishing the task. For example, "log a walk" might be:</p>
<ol>
<li>Open the app and see today's clients.</li>
<li>Tap a client.</li>
<li>Tap "Start walk".</li>
<li>Add a photo and a note during the walk.</li>
<li>Tap "End walk" and review the summary.</li>
<li>Tap "Send to owner" and see a confirmation.</li>
</ol>
<p>Then look for problems. Are there unnecessary steps? What happens if the user has no clients yet, loses signal or closes the app halfway through? Add these alternative paths and error cases to the flow, because they are where many real-world bugs hide.</p>
<h3>First run and onboarding</h3>
<p>Map what a brand-new user sees. Keep onboarding short, let people experience the core value as soon as possible, and delay account creation until it is genuinely needed if your app allows that.</p>
<h2>Sketching wireframes</h2>
<p>Start on paper or a whiteboard. Draw one rectangle per screen in your flow and sketch the main elements: titles, lists, buttons and inputs. Rough sketches encourage you to explore options without getting attached to details.</p>
<p>When the flow feels right, move to a design tool to create cleaner wireframes and, if useful, a clickable prototype that links screens together. Many design tools let you preview prototypes on a real phone, which is the best way to judge sizes and reach.</p>
<h3>What to include in a wireframe</h3>
<ul>
<li>The screen title and navigation elements.</li>
<li>Realistic content rather than placeholder text, so you see how long names and messages behave.</li>
<li>The primary action, clearly placed.</li>
<li>Empty, loading and error states for screens that show data.</li>
</ul>
<h2>Test with real people</h2>
<p>Show your prototype to three to five people from your target group. Give them a task, such as "log a walk for Bella the dog", and watch without helping. Note where they hesitate, tap the wrong thing or ask questions. Even a handful of sessions like this usually reveals the most serious usability problems.</p>
<h3>Flow and wireframe checklist</h3>
<ol>
<li>A flow exists for each core task, including empty and error cases.</li>
<li>Every screen in the flows has a wireframe.</li>
<li>The prototype has been tested with at least three people.</li>
<li>Findings are written down, along with the changes you made.</li>
</ol>
<h3>Try this</h3>
<p>Draw the flow for your most important task and sketch its screens on paper. Link the sketches in a simple prototyping tool, or simply swap the paper screens by hand, and run one test with a friend.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Following platform conventions', $t$Use the Human Interface Guidelines and Material Design so your app feels familiar on each platform.$t$, 'article', 2, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>People spend most of their phone time in apps made by others, and those apps have taught them how things work: where the back control is, what a tab bar does, how to delete an item. When your app follows these conventions, users feel at home immediately. When it ignores them, every interaction needs extra thought.</p>
<h2>The official design guidance</h2>
<ul>
<li><strong>Apple's <a href="https://developer.apple.com/design/human-interface-guidelines/">Human Interface Guidelines</a></strong> describe how iOS and iPadOS apps should look and behave, from navigation and typography to accessibility and privacy.</li>
<li><strong>Material Design</strong> is Google's design system, widely used for Android apps. The <a href="https://developer.android.com/">Android developer documentation</a> also covers layout, navigation and app quality guidance.</li>
</ul>
<p>Read the sections on navigation, layout and controls before designing your main screens. The guidance is updated as platforms evolve, so revisit it before each major release.</p>
<h2>Differences you will notice</h2>
<ul>
<li><strong>Back navigation.</strong> iOS apps usually show a back button at the top left and support an edge swipe. Android has a system back gesture or button that your app must handle sensibly.</li>
<li><strong>Navigation bars.</strong> Both platforms use bottom bars for top-level sections, but styling and behaviour differ.</li>
<li><strong>Controls.</strong> Switches, date pickers, alerts and menus look and behave differently on each platform.</li>
<li><strong>Typography.</strong> Each platform has its own system font and text styles.</li>
</ul>
<h2>Consistency versus brand</h2>
<p>You can express your brand through colour, imagery, icons and tone of voice while still following platform patterns for structure and behaviour. A useful rule: be distinctive in look, conventional in behaviour.</p>
<p>Cross-platform frameworks handle this differently. React Native uses each platform's native components for many basics, so some differences appear automatically. Flutter provides widget sets for both Material and Apple-style designs. Whichever you use, test on both platforms and check that the app behaves as each platform's users expect, especially back navigation.</p>
<h2>Build a small design system</h2>
<p>Before designing many screens, define reusable basics:</p>
<ol>
<li>A colour palette for primary, secondary, background, text and error colours, checked for sufficient contrast.</li>
<li>A type scale with a few styles, such as title, heading, body and caption.</li>
<li>A spacing scale, for example multiples of 4 or 8.</li>
<li>Core components: buttons, input fields, list items, cards and empty states.</li>
<li>Dark mode colours from the start, if you plan to support it.</li>
</ol>
<p>Reusing these elements keeps your app consistent and speeds up development, because each component is designed once and used everywhere.</p>
<h3>Try this</h3>
<p>Read the navigation guidance for both platforms. Then review your wireframes, mark any place where your design conflicts with platform conventions, and decide whether each difference is truly justified.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Accessibility and inclusive design', $t$Make your app usable with screen readers, larger text and other assistive features.$t$, 'article', 3, 10, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Accessible apps can be used by people with a wide range of abilities, including people who are blind or have low vision, are deaf or hard of hearing, or have motor or cognitive disabilities. Many accessibility improvements help everyone, such as clear labels, good contrast in bright sunlight and large touch targets. In some markets and sectors, accessibility is also a legal requirement.</p>
<h2>Platform accessibility features</h2>
<p>Both platforms include assistive technologies your app should work with:</p>
<ul>
<li><strong>Screen readers</strong> – VoiceOver on iOS and TalkBack on Android read content aloud and let users navigate with gestures.</li>
<li><strong>Text size settings</strong> – users can increase the system font size, and your layout should adapt.</li>
<li><strong>Display options</strong> – such as increased contrast, reduced motion and colour inversion.</li>
<li><strong>Switch and voice control</strong> – for people who cannot use a touchscreen in the usual way.</li>
</ul>
<h2>Key practices</h2>
<h3>Label everything meaningful</h3>
<p>Buttons that show only an icon need an accessible label that a screen reader can announce, such as "Add photo". Purely decorative images should be hidden from screen readers.</p>
<h3>Example (React Native)</h3>
<p>A tappable icon can be given a label and a role with props such as <code>accessibilityLabel="Add photo"</code> and <code>accessibilityRole="button"</code>. Flutter offers the <code>Semantics</code> widget for the same purpose.</p>
<h3>Contrast and colour</h3>
<p>Make sure text has enough contrast against its background, following the platform guidelines or the Web Content Accessibility Guidelines (WCAG). Never rely on colour alone to convey meaning; pair a red error state with an icon or message.</p>
<h3>Dynamic text and layout</h3>
<p>Avoid fixed-height containers that cut off text when users choose larger sizes. Test with the largest text setting and make sure nothing important is hidden.</p>
<h3>Touch and motion</h3>
<p>Keep touch targets large and well spaced, and respect the reduced motion setting by toning down animations.</p>
<h2>Accessibility testing steps</h2>
<ol>
<li>Turn on VoiceOver or TalkBack and complete your core task without looking at the screen.</li>
<li>Set the system text size to the largest option and check every screen.</li>
<li>Check the contrast of text and key icons with a contrast checker.</li>
<li>Use Accessibility Inspector in Xcode, or the Accessibility Scanner app on Android, to find common issues.</li>
<li>Where possible, ask people who use assistive technology every day for feedback.</li>
</ol>
<h3>Try this</h3>
<p>Turn on your phone's screen reader and try to complete a simple task in an app you use often. Then review your own wireframes and add an accessible label to every icon-only button.</p>$h$));

  -- Module 3
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Core building blocks', $t$Build the screens, navigation, state and input handling that every app relies on.$t$, 2) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Screens and components', $t$Break your designs into reusable components and assemble them into screens with flexible layouts.$t$, 'article', 0, 12, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Every modern mobile framework builds interfaces from small, reusable pieces called components (Flutter calls them widgets). A screen is simply a component made of other components: a header, a list, list items and buttons. Learning to think in components is the most important step from design to code.</p>
<h2>Thinking in components</h2>
<p>Look at one of your wireframes and draw boxes around repeated or self-contained parts. A client list screen might break down into a <em>ScreenHeader</em>, a <em>SearchField</em>, a <em>ClientList</em> made of many <em>ClientRow</em> items, and an <em>AddButton</em>. Each component has one job, can be reused and can be built and tested on its own.</p>
<h3>Inputs and output</h3>
<p>Components receive data from their parent, called props in React Native or constructor parameters in Flutter, and turn it into what appears on screen. A <em>ClientRow</em> might receive a name and a function to call when tapped. Because it depends only on what it is given, you can reuse it anywhere.</p>
<h2>Example (React Native)</h2>
<p>React Native provides building blocks such as <code>View</code> for layout containers, <code>Text</code> for all text, <code>Image</code>, <code>Pressable</code> for tappable areas and <code>FlatList</code> for long scrolling lists. A simple row component might look like this:</p>
<p><code>function ClientRow({ name, onPress }) { return &lt;Pressable onPress={onPress}&gt;&lt;Text&gt;{name}&lt;/Text&gt;&lt;/Pressable&gt;; }</code></p>
<p>The parent screen then renders <code>&lt;ClientRow name="Bella" onPress={openClient} /&gt;</code> for each client. In Flutter, the equivalent is a widget class built from <code>Text</code> and <code>ListTile</code> or <code>GestureDetector</code>.</p>
<h2>Layout basics</h2>
<p>Mobile frameworks arrange components in rows and columns. React Native uses Flexbox, configured with style properties such as <code>flexDirection</code>, <code>justifyContent</code> and <code>alignItems</code>. Flutter uses widgets such as <code>Row</code>, <code>Column</code> and <code>Expanded</code>. In both, think in flexible proportions rather than fixed pixel positions, so layouts adapt to different screens.</p>
<h3>Respect safe areas</h3>
<p>Modern phones have notches, rounded corners and system bars. Use your framework's safe area support so content is not hidden behind them.</p>
<h2>Lists done right</h2>
<p>For anything that could grow long, use a virtualised list such as <code>FlatList</code> or Flutter's <code>ListView.builder</code>. These render only the items currently visible, keeping scrolling smooth and memory use low. Give each item a stable, unique key.</p>
<h2>Component-building steps</h2>
<ol>
<li>Break each wireframe into named components.</li>
<li>Build the smallest components first, using hard-coded sample data.</li>
<li>Assemble them into the full screen.</li>
<li>Apply styles from your design system rather than one-off values.</li>
<li>Check the screen on a small phone, a large phone and with large text enabled.</li>
</ol>
<h3>Try this</h3>
<p>Build the main screen of your app using hard-coded sample data. Create at least three separate components, including one that is reused in a list.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Navigation patterns: stacks, tabs and modals', $t$Choose the right navigation pattern for each part of your app and make back behave as users expect.$t$, 'article', 1, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Navigation is how users move between screens, and it shapes how your whole app feels. Most apps combine three standard patterns. Choosing the right one for each part of your app keeps users oriented and makes going back behave the way they expect.</p>
<h2>The three core patterns</h2>
<h3>Stack navigation</h3>
<p>Screens are pushed onto a stack as the user drills deeper and popped off when they go back. Moving from a client list to a client's details to a single walk is a stack. Use stacks for hierarchical, drill-down content.</p>
<h3>Tab navigation</h3>
<p>A tab bar, usually at the bottom of the screen, switches between a few top-level sections, such as Today, Clients and Settings. Each tab often contains its own stack, and switching tabs should preserve where the user was in each. Keep tabs to a small number of genuinely top-level destinations, as the platform guidelines recommend.</p>
<h3>Modal presentation</h3>
<p>A modal appears over the current screen for a focused, self-contained task, such as adding a client or composing a message. It needs a clear way to finish or cancel. If users must navigate around inside it, it probably should not be a modal.</p>
<h2>Example (React Native)</h2>
<p>React Native does not include navigation itself, so you add a library. Two common choices are <strong>React Navigation</strong>, which configures stacks and tabs in code, and <strong>Expo Router</strong>, which builds on React Navigation and creates routes from your file structure. With Expo Router, a file at <code>app/clients/[id].tsx</code> becomes the screen for a specific client, and you can open it with a call such as <code>router.push('/clients/42')</code>. Check the current documentation for whichever library you choose, as APIs change between major versions. In Flutter, navigation uses the built-in <code>Navigator</code> or packages such as <code>go_router</code>.</p>
<h2>Passing data between screens</h2>
<p>Pass small identifiers, such as a client ID, rather than whole objects. The destination screen then loads the data it needs. This keeps screens independent and makes deep links possible.</p>
<h3>Deep links</h3>
<p>A deep link opens a specific screen from outside the app, for example from a notification or an email. Universal Links on iOS and App Links on Android connect web URLs to your app. Clear, stable route names make these much easier to add later.</p>
<h2>Navigation checklist</h2>
<ol>
<li>Sketch a navigation map showing every screen and how it is reached.</li>
<li>Decide which sections are tabs, which flows are stacks and which tasks are modals.</li>
<li>Make sure back always goes somewhere sensible, including the Android system back action.</li>
<li>Check that each tab remembers its position when users switch away and back.</li>
<li>Give routes clear, stable names you could reuse for deep links.</li>
</ol>
<h3>Try this</h3>
<p>Create your navigation structure with placeholder screens: a tab bar with your top-level sections, one stack that drills down two levels and one modal. Test back behaviour on both an iOS Simulator and an Android Emulator.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Managing state', $t$Understand local, shared, server and navigation state, and keep each in the right place.$t$, 'article', 2, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>State is any data that can change while your app is running and affects what the user sees: the text in a search field, whether a menu is open, the list of clients, the signed-in user. Managing state well makes an app feel predictable. Managing it badly leads to screens showing out-of-date information and bugs that are hard to reproduce.</p>
<h2>Types of state</h2>
<ul>
<li><strong>Local UI state</strong> – belongs to one component, such as whether a password is visible or the current value of an input.</li>
<li><strong>Shared app state</strong> – needed by many screens, such as the signed-in user, the theme or a shopping basket.</li>
<li><strong>Server state</strong> – data that lives on a server and is copied into the app, such as a list of orders. It can become stale and needs refreshing.</li>
<li><strong>Navigation state</strong> – which screen is showing, usually managed by your navigation library.</li>
</ul>
<p>Treating these differently is the key idea. Many beginner state problems come from putting everything in one place, or copying the same data into several places that then disagree.</p>
<h2>Start simple</h2>
<p>Keep state as close as possible to where it is used. If only one component needs it, keep it there. Move state up to a shared parent only when sibling components need it, and into a global store only when many unrelated screens do.</p>
<h2>Example (React Native)</h2>
<p>React's <code>useState</code> hook holds local state: <code>const [query, setQuery] = useState('');</code> creates a value and a function to update it. Calling <code>setQuery</code> re-renders the component with the new value. For shared state, React Context passes values down without threading props through every level. Larger apps often add a small state library, plus a data-fetching library that handles caching and refreshing of server state. In Flutter, common approaches are <code>setState</code> for local state and packages such as Provider or Riverpod for shared state.</p>
<h2>Rules that prevent bugs</h2>
<ul>
<li><strong>Single source of truth.</strong> Each piece of data should live in one place, with other values derived from it rather than copied.</li>
<li><strong>Update immutably.</strong> Create new objects or arrays instead of changing existing ones in place, so the framework can detect the change.</li>
<li><strong>Model loading and errors explicitly.</strong> Server data is not just "the data"; it can be loading, loaded, empty or failed.</li>
<li><strong>Do not store what you can calculate.</strong> A count of completed walks can be computed from the list of walks.</li>
</ul>
<h2>State planning steps</h2>
<ol>
<li>List every piece of changing data in your app.</li>
<li>Label each one as local, shared, server or navigation state.</li>
<li>Decide where each will live, starting as locally as possible.</li>
<li>Identify values that can be derived rather than stored.</li>
<li>Add extra libraries only when the simple approach becomes painful.</li>
</ol>
<h3>Try this</h3>
<p>Add one piece of local state to your app, such as a search field that filters your hard-coded list, and one piece of shared state, such as a user name shown on two different screens.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Handling user input and forms', $t$Build forms that are quick to complete on a phone, handle the keyboard and explain errors clearly.$t$, 'article', 3, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Forms are where users give your app information: signing up, adding a client, writing a note. They are also where many users give up. A well-built form asks only for what is necessary, makes entry easy on a small keyboard and handles mistakes kindly.</p>
<h2>Ask for less</h2>
<p>Review every field against your product spec. If a field is optional, consider removing it or asking later. Split long forms into short steps and show progress, so users know how much remains.</p>
<h2>Make entry easy</h2>
<ul>
<li><strong>Choose the right keyboard.</strong> Use numeric, email, phone or URL keyboards to match each field.</li>
<li><strong>Enable autofill.</strong> Mark fields such as name, email, address and one-time codes so the operating system and password managers can fill them.</li>
<li><strong>Set capitalisation and correction.</strong> Turn off auto-capitalisation and autocorrect for emails and usernames.</li>
<li><strong>Use pickers and toggles</strong> for dates, times and fixed options instead of free text.</li>
<li><strong>Label every field</strong> with a visible label, not just placeholder text that disappears as the user types.</li>
</ul>
<h2>Example (React Native)</h2>
<p>A <code>TextInput</code> for an email address can use props such as <code>keyboardType="email-address"</code>, <code>autoCapitalize="none"</code>, <code>autoComplete="email"</code> and, for iOS autofill, <code>textContentType="emailAddress"</code>. In Flutter, <code>TextField</code> offers <code>keyboardType</code> and <code>autofillHints</code> for similar behaviour.</p>
<h2>Handle the keyboard</h2>
<p>The on-screen keyboard can cover half the screen, including the field being edited or the submit button. Use your framework's keyboard-avoiding layout or scroll the focused field into view. Let users move to the next field with the return key, and dismiss the keyboard when they tap outside a field.</p>
<h2>Validation and errors</h2>
<ul>
<li>Validate when the user leaves a field or submits, rather than flagging errors before they have finished typing.</li>
<li>Show errors next to the field in plain language that explains the fix, such as "Enter an email address like name@example.com".</li>
<li>Keep what the user typed when an error occurs; never clear the whole form.</li>
<li>Always validate again on the server. Checks in the app improve the experience, but they can be bypassed.</li>
<li>Show a loading state while submitting and prevent the same form being sent twice.</li>
</ul>
<h2>Form checklist</h2>
<ol>
<li>Every field is necessary and has a visible label.</li>
<li>Keyboard type, autofill and capitalisation are set for each field.</li>
<li>The focused field and submit button stay visible when the keyboard is open.</li>
<li>Errors are specific, shown next to the field and announced by screen readers.</li>
<li>Submissions show progress and cannot be sent twice by accident.</li>
</ol>
<h3>Try this</h3>
<p>Build the main form in your app, such as "Add client", with at least three fields. Test it on a real device: fill it in with one hand, trigger each validation error and check that the keyboard never hides the submit button.</p>$h$));

  -- Module 4
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Data, testing and release preparation', $t$Connect your app to real data, store information on the device, test thoroughly and get ready for store review.$t$, 3) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Working with APIs', $t$Call APIs reliably, handle loading, empty, error and offline states, and keep secrets off the device.$t$, 'article', 0, 14, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Most apps need data from somewhere else: a list of products, a user's account, the weather. That data usually comes from an API (application programming interface), a server endpoint your app calls over the internet. Calling APIs reliably, and handling everything that can go wrong, is a core mobile skill.</p>
<h2>How a typical API call works</h2>
<ol>
<li>Your app sends an HTTP request to a URL, such as <code>GET https://api.example.com/clients</code>.</li>
<li>The request may include headers, such as an authentication token, and a body when creating or updating data.</li>
<li>The server responds with a status code and, usually, data in JSON format.</li>
<li>Your app checks the status, parses the JSON and updates its state, which updates the screen.</li>
</ol>
<p>Common methods are <code>GET</code> to read, <code>POST</code> to create, <code>PUT</code> or <code>PATCH</code> to update and <code>DELETE</code> to remove. Status codes in the 200s mean success, the 400s mean a problem with the request (such as 401 for not authenticated or 404 for not found), and the 500s mean a server error.</p>
<h2>Example (React Native)</h2>
<p>React Native includes the standard <code>fetch</code> function. Inside an async function you might write <code>const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });</code>, then check that <code>res.ok</code> is true before calling <code>await res.json()</code>. In Flutter, the <code>http</code> or <code>dio</code> packages fill the same role.</p>
<h2>Design for every state</h2>
<p>Each API call has more outcomes than success. Your screens should handle them all:</p>
<ul>
<li><strong>Loading</strong> – show a spinner or placeholder, and avoid layout jumps when data arrives.</li>
<li><strong>Success with data</strong> – display it.</li>
<li><strong>Success with no data</strong> – show a helpful empty state.</li>
<li><strong>Error</strong> – explain the problem in plain language and offer a retry.</li>
<li><strong>Offline</strong> – show cached data if you have it and retry when the connection returns.</li>
</ul>
<p>Set timeouts so requests do not hang forever, and avoid firing the same request again while one is already in progress.</p>
<h2>Security basics</h2>
<ul>
<li>Use HTTPS. Both platforms restrict unencrypted HTTP connections by default.</li>
<li>Never put secret keys, such as payment or admin keys, inside your app, because anything shipped in an app can be extracted. Keep secrets on your server.</li>
<li>Store authentication tokens in secure storage, covered in the next lesson.</li>
<li>Treat data from the network as untrusted and validate it before use.</li>
</ul>
<h3>API integration checklist</h3>
<ol>
<li>Document each endpoint your app uses, with its method, inputs and response.</li>
<li>Keep API calls in one module rather than scattered across screens.</li>
<li>Handle loading, empty, error and offline states on every data screen.</li>
<li>Test with slow and disconnected networks.</li>
</ol>
<h3>Try this</h3>
<p>Replace the hard-coded data on your main screen with data from a real API, such as a public test API or a backend service. Then switch your device to airplane mode and make sure the screen shows a clear message rather than crashing.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Storing data on the device', $t$Choose between key-value storage, secure storage, databases and files, and keep offline data in sync.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Not everything needs to come from a server every time. Storing data on the device makes your app faster, lets it work offline and remembers preferences between sessions. The right storage option depends on what you are saving and how sensitive it is.</p>
<h2>Storage options</h2>
<h3>Key-value storage for small settings</h3>
<p>For simple preferences such as the theme, whether onboarding is complete or the last selected tab, use key-value storage. Natively, iOS provides UserDefaults and Android provides DataStore or SharedPreferences. In React Native a common choice is the AsyncStorage library, and Flutter has the <code>shared_preferences</code> package. These stores are not encrypted, so never keep passwords or tokens in them.</p>
<h3>Secure storage for secrets</h3>
<p>Authentication tokens, and anything else that would harm the user if stolen, belong in platform secure storage: the <strong>Keychain</strong> on iOS, and on Android data encrypted with keys protected by the <strong>Android Keystore</strong> system. Cross-platform libraries such as Expo SecureStore or <code>flutter_secure_storage</code> wrap these for you.</p>
<h3>Databases for structured data</h3>
<p>When you have many records to search, sort or relate, such as hundreds of walks with notes, use a local database. SQLite is available on both platforms and widely supported by cross-platform libraries. Native options include SwiftData or Core Data on iOS and Room on Android.</p>
<h3>Files for media</h3>
<p>Save photos, audio and documents as files in your app's storage directories, with the database holding only their paths. Large media does not belong in key-value storage.</p>
<h2>Example (React Native)</h2>
<p>Saving a preference with AsyncStorage looks like <code>await AsyncStorage.setItem('theme', 'dark');</code> and reading it back like <code>const theme = await AsyncStorage.getItem('theme');</code>. Values are strings, so convert objects with <code>JSON.stringify</code> and <code>JSON.parse</code>.</p>
<h2>Offline and sync basics</h2>
<p>If your app works offline, decide how local and server data stay in step. A simple, robust approach for a first app:</p>
<ol>
<li>Show cached data as soon as a screen opens.</li>
<li>Fetch fresh data in the background, then update the cache and the screen.</li>
<li>Queue changes made offline and send them when the connection returns.</li>
<li>Decide what happens when the same record changed in two places, for example "latest change wins", and tell users if a conflict occurs.</li>
</ol>
<h2>Privacy and housekeeping</h2>
<ul>
<li>Store only what you need, and clear it when the user signs out or deletes their account.</li>
<li>Plan for data migrations: when your data format changes, existing users' stored data must still load.</li>
<li>Users can clear app data or reinstall, so important data should also live on a server.</li>
</ul>
<h3>Try this</h3>
<p>Add two kinds of storage to your app: save a user preference so it survives a restart, and cache your API data so the main screen shows something useful when the device is offline.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Testing your app', $t$Combine unit, component and end-to-end tests with real-device checks and beta testing.$t$, 'article', 2, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Testing is how you find problems before your users do, and store reviewers also reject apps that crash or have obvious defects. A sensible approach for a first app combines a few automated tests with structured manual testing on real devices.</p>
<h2>Kinds of tests</h2>
<h3>Unit tests</h3>
<p>Unit tests check small pieces of logic in isolation, such as a function that calculates the length of a walk or validates an email address. They are fast and cheap, so write them for any logic where a mistake would matter.</p>
<h3>Component tests</h3>
<p>These render a single component and check its behaviour: does the error message appear when a field is empty, and does the button call the right function when pressed? In React Native, Jest with React Native Testing Library is a common combination; Flutter includes widget tests in its test framework.</p>
<h3>End-to-end tests</h3>
<p>End-to-end (E2E) tests drive the whole app on a simulator or device, tapping and typing like a user. Options include Detox or Maestro for React Native, Flutter integration tests, XCTest UI tests on iOS and Espresso on Android. They are slower and more fragile, so reserve them for your most important flows, such as sign-in and the core task.</p>
<h2>Example (React Native)</h2>
<p>A simple Jest unit test might read <code>test('formats minutes', () =&gt; { expect(formatDuration(90)).toBe('1h 30m'); });</code>. Run your tests on every change, ideally automatically, so mistakes are caught immediately.</p>
<h2>Manual testing on real devices</h2>
<p>Automated tests cannot catch everything. Before each release, work through a written test plan on real devices, covering:</p>
<ul>
<li>At least one iPhone and one Android phone, ideally including an older or lower-powered model.</li>
<li>Small and large screens, and the largest text size setting.</li>
<li>Slow networks, no network and switching networks mid-task.</li>
<li>Interruptions such as calls, switching apps and locking the screen.</li>
<li>Refused permissions, such as denying camera or location access.</li>
<li>A fresh install and an update from the previous version.</li>
</ul>
<h2>Beta testing</h2>
<p>Both stores let you share pre-release builds. Apple's <strong>TestFlight</strong> distributes beta builds to internal and external testers, and Google Play's <strong>testing tracks</strong> (internal, closed and open) release builds to chosen groups before production. Beta testers find issues you never would, because they use the app their own way on their own devices.</p>
<p>Add a crash reporting tool before your beta so you receive details of every crash, including the device, OS version and code location.</p>
<h2>Release testing checklist</h2>
<ol>
<li>All unit and component tests pass.</li>
<li>End-to-end tests pass for your core flows.</li>
<li>The manual test plan is complete on both platforms.</li>
<li>Critical beta feedback is resolved.</li>
<li>The latest beta shows no unresolved crashes.</li>
</ol>
<h3>Try this</h3>
<p>Write three unit tests for logic in your app and a one-page manual test plan for your core task. Run the plan on a real device with no network connection and note every problem you find.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Preparing for store review: guidelines, privacy and assets', $t$Get your policies, privacy disclosures, listing assets and builds ready before you submit.$t$, 'article', 3, 14, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Apple and Google both review apps against published policies before they reach users, and both can remove apps that later break the rules. Most rejections are avoidable if you read the guidelines early and prepare carefully. This lesson covers what to get ready; the next lesson walks through the submission itself.</p>
<h2>Read the official rules</h2>
<ul>
<li><strong>The <a href="https://developer.apple.com/app-store/review/guidelines/">App Store Review Guidelines</a></strong> cover safety, performance, business models including in-app purchases, design and legal requirements.</li>
<li><strong>The Google Play Developer Program Policies</strong>, published in the Play Console Help Center and Policy Center, cover restricted content, privacy, permissions, monetisation and more.</li>
</ul>
<p>Both are updated regularly, often with compliance deadlines. Check them before each major release rather than relying on articles or memory.</p>
<h2>Common reasons for rejection</h2>
<ul>
<li>Crashes, broken links or obvious bugs found during review.</li>
<li>Missing information, such as demo account details when the app requires sign-in.</li>
<li>Placeholder content or features that do not work yet.</li>
<li>Descriptions or screenshots that do not reflect the app.</li>
<li>Permission requests without a clear need or explanation.</li>
<li>Selling digital goods in a way the store's payment rules do not allow. These rules are complex and vary by region, so read the current guidance carefully.</li>
</ul>
<h2>Privacy requirements</h2>
<ul>
<li><strong>Privacy policy.</strong> Both stores expect a link to a privacy policy that accurately describes what data you collect and why.</li>
<li><strong>Data disclosures.</strong> App Store Connect asks for App Privacy details, and Google Play requires a Data safety form. Your answers must include data collected by third-party libraries in your app, such as analytics or advertising tools.</li>
<li><strong>Permissions.</strong> Explain each permission in a clear purpose message and request access only when needed.</li>
<li><strong>Account deletion.</strong> If users can create an account in your app, both stores expect you to offer a way to request its deletion. Check the current requirements for details.</li>
</ul>
<h2>Store listing assets</h2>
<ol>
<li>An accurate app name and short description, not stuffed with keywords.</li>
<li>A full description of what the app does and who it is for.</li>
<li>An app icon that meets each platform's specifications.</li>
<li>Screenshots of real app screens for the required device sizes.</li>
<li>A category, content rating answers, and support and privacy policy URLs.</li>
</ol>
<h2>Technical preparation</h2>
<ul>
<li>Choose a unique bundle identifier (iOS) and application ID (Android); you cannot change them once the app is published.</li>
<li>Use clear version numbers and increase the build number for every upload.</li>
<li>Meet each store's current target SDK and build tool requirements.</li>
<li>Remove debug logging, test endpoints and developer menus from release builds.</li>
</ul>
<h3>Try this</h3>
<p>Read the policy sections that apply to your app's features in both stores. Then draft your privacy policy outline, your data disclosure answers and the text for your store listing.</p>$h$));

  -- Module 5
  insert into public.course_modules (course_id, title, description, sort_order)
    values (c, 'Publishing and growing your app', $t$Submit your app to both stores, then use data and feedback to improve it after launch.$t$, 4) returning id into m;

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Publishing to the App Store and Google Play', $t$Walk through developer accounts, signed builds, testing tracks, listings and review on both stores.$t$, 'article', 0, 14, true, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>With your app tested and your listing prepared, you are ready to submit. Each store has its own console, but the overall process is similar: create a developer account, create an app record, upload a signed build, complete the listing and compliance forms, test with a small group and submit for review. Screens and requirements change, so follow the official guides as you go.</p>
<h2>Developer accounts</h2>
<p>You need an <strong>Apple Developer Program</strong> membership to publish on the App Store and a <strong>Google Play developer account</strong> to publish on Google Play. Both involve a registration fee and identity verification, and organisations usually need to provide extra business details, such as a D-U-N-S number. Check current fees and requirements on <a href="https://developer.apple.com/">Apple's developer site</a> and in the Play Console Help Center, and allow time for verification.</p>
<h2>Publishing on the App Store</h2>
<ol>
<li>In App Store Connect, create an app record with its name, primary language, bundle ID and SKU.</li>
<li>Create a release build signed for distribution, using Xcode or your framework's build service.</li>
<li>Upload the build and wait for it to finish processing in App Store Connect.</li>
<li>Distribute it to testers with TestFlight and fix any issues.</li>
<li>Complete the version page: screenshots, description, keywords, support URL, age rating, App Privacy details and review notes, including demo credentials if needed.</li>
<li>Submit for review, choosing whether to release automatically or manually once approved.</li>
</ol>
<h2>Publishing on Google Play</h2>
<ol>
<li>In the Play Console, create an app and complete the app content declarations, including the Data safety form, content rating questionnaire and target audience.</li>
<li>Build a signed Android App Bundle (<code>.aab</code>), the format Google Play requires for new apps. Play App Signing manages the final signing key.</li>
<li>Upload to a testing track first. Google Play may require newer personal developer accounts to run a closed test with a minimum number of testers before production access; check the current requirement.</li>
<li>Complete the store listing: short and full descriptions, icon, feature graphic and screenshots.</li>
<li>Create a production release and submit it for review, ideally as a staged rollout to a percentage of users first.</li>
</ol>
<h2>If your app is rejected</h2>
<p>Rejections are common, especially for a first app. Read the reviewer's message carefully, check the guideline it cites, fix the issue and resubmit. If you believe the reviewer misunderstood something, explain politely with clear steps or a screen recording. Both stores provide a way to appeal.</p>
<h3>Launch checklist</h3>
<ul>
<li>Developer accounts verified on both stores.</li>
<li>Signed builds tested through TestFlight and a Play testing track.</li>
<li>Listings, privacy disclosures and ratings complete.</li>
<li>Reviewer notes and demo credentials provided where needed.</li>
<li>A support email ready for user questions.</li>
</ul>
<h3>Try this</h3>
<p>Write a launch plan with a line for each checklist item, an owner and a target date. If you already have a developer account, upload a test build to TestFlight or an internal testing track.</p>$h$));

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'After launch: measure, learn and iterate', $t$Monitor stability, track meaningful metrics, listen to users and ship small, regular improvements.$t$, 'article', 1, 12, false, 'manual') returning id into l;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, data)
    values (l, c, 'rich_text', 0, jsonb_build_object('html', $h$<p>Publishing is the start of your app's life, not the end. The first weeks after launch show you how real people use your app, where they struggle and what they value. A steady cycle of measuring, learning and releasing improvements is what turns a first version into a successful product.</p>
<h2>Watch stability first</h2>
<p>Crashes and freezes drive users away and lead to poor reviews. Check your crash reporting tool daily after launch, and use the platform dashboards too: the Xcode Organizer and App Store Connect for iOS, and Android vitals in the Play Console, which highlights problems such as crashes and "app not responding" (ANR) errors. Fix critical issues first and release a quick update if needed.</p>
<h2>Measure what matters</h2>
<p>Choose a few metrics linked to the success measures in your product spec:</p>
<ul>
<li><strong>Activation</strong> – the share of new users who complete the core task for the first time.</li>
<li><strong>Retention</strong> – how many users return after a day, a week and a month.</li>
<li><strong>Engagement</strong> – how often active users complete the core task.</li>
<li><strong>Conversion</strong> – if you charge, how many users subscribe or buy.</li>
</ul>
<p>Use an analytics tool to record key events, such as <code>walk_started</code> and <code>summary_sent</code>. Collect only what you need, disclose it in your privacy details and respect users' consent choices, including Apple's App Tracking Transparency rules if you track users across other companies' apps or websites.</p>
<h2>Listen to users</h2>
<ul>
<li>Read every store review and reply professionally, especially when you fix a reported problem.</li>
<li>Provide an easy way to send feedback or contact support from inside the app.</li>
<li>Talk to a few active users and a few who stopped using the app.</li>
</ul>
<p>Look for patterns rather than reacting to every request. A problem raised by many users usually matters more than a feature requested loudly by one.</p>
<h2>Improve your store presence</h2>
<p>App store optimisation (ASO) means improving your listing so the right people find and install your app. Keep listings accurate, test clearer screenshots and descriptions, and use the stores' built-in experiment tools where available, such as product page optimisation on the App Store and store listing experiments on Google Play.</p>
<h2>A sustainable release cycle</h2>
<ol>
<li>Collect data and feedback continuously.</li>
<li>Every few weeks, choose a small set of improvements that best serve your core users.</li>
<li>Build, test and release to beta testers first.</li>
<li>Use phased or staged rollouts to limit the impact of any new bug.</li>
<li>Keep dependencies and SDK versions current to meet store requirements and support new OS releases.</li>
</ol>
<blockquote>Small, regular, well-tested updates are easier to manage and safer than rare, huge releases.</blockquote>
<h3>Try this</h3>
<p>Define three metrics for your app and the events needed to measure them. Then write a simple feedback plan: where users can contact you, how often you will review feedback and how you will decide what to build next.</p>$h$));

  -- Module 5 quiz lesson
  insert into public.quizzes (course_id, title, description, passing_score, shuffle_options, show_correct_answers, status, counts_toward_completion)
    values (c, 'Course quiz', 'Check your understanding of the whole course.', 70, true, 'after_submit', 'published', true) returning id into qz;

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$What is the main trade-off of fully native development compared with a cross-platform framework?$t$, $t$Native development gives full access to each platform's features and components, but you usually maintain a separate codebase, and often separate skills, for iOS and Android.$t$, 1, 0) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$You usually maintain a separate codebase for each platform$t$, true, 0),
    (qq, $t$Native apps cannot use device features such as the camera$t$, false, 1),
    (qq, $t$Native apps cannot be published to the app stores$t$, false, 2),
    (qq, $t$Native apps must run inside a web browser$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which description best fits a minimum viable product (MVP)?$t$, $t$An MVP is the smallest version that lets real users complete the core task well, so you can launch sooner and learn from actual usage before adding more.$t$, 1, 1) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$The smallest version that lets users complete the core task well, so you can learn from real usage$t$, true, 0),
    (qq, $t$A version with every planned feature, built quickly at low quality$t$, false, 1),
    (qq, $t$A marketing website that describes the app$t$, false, 2),
    (qq, $t$The final version of the app after several years of updates$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$The iOS Simulator and Android Emulator reproduce real devices closely enough that testing on physical devices before release is unnecessary.$t$, $t$False. Simulators and emulators are excellent for daily development, but performance, camera, sensors, notifications and touch can differ on real hardware, so test on physical devices before release.$t$, 1, 2) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, 'True', false, 0),
    (qq, 'False', true, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$Which practices improve the accessibility of a mobile app? Select all that apply.$t$, $t$Accessible labels let screen readers announce icon-only buttons, flexible layouts keep text readable at larger sizes, and pairing colour with icons or text helps people who cannot distinguish colours. Fixed-height text containers and colour-only signals create barriers.$t$, 1, 3) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Giving icon-only buttons an accessible label$t$, true, 0),
    (qq, $t$Making layouts adapt when users choose larger text$t$, true, 1),
    (qq, $t$Pairing colour with an icon or message to show errors$t$, true, 2),
    (qq, $t$Using fixed-height containers so text never wraps$t$, false, 3),
    (qq, $t$Showing errors using colour alone$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Which navigation pattern best suits a focused, self-contained task such as adding a new client?$t$, $t$A modal presents a focused task over the current context, with a clear way to finish or cancel. Tabs are for top-level sections and stacks for drill-down content.$t$, 1, 4) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$A modal$t$, true, 0),
    (qq, $t$A new tab in the tab bar$t$, false, 1),
    (qq, $t$A three-level drill-down stack$t$, false, 2),
    (qq, $t$A deep link from an email$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Following the single source of truth principle, how should your app get the number of completed walks?$t$, $t$The count can be calculated from the list of walks, so storing it separately would create a second copy that can fall out of step. Derive values like this instead of storing them.$t$, 1, 5) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Calculate it from the list of walks whenever it is needed$t$, true, 0),
    (qq, $t$Store it in a separate variable and update it by hand$t$, false, 1),
    (qq, $t$Keep a separate copy in each screen that shows it$t$, false, 2),
    (qq, $t$Request it from the server every second$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$Where should your app store a user's authentication token on the device?$t$, $t$Tokens are sensitive. Platform secure storage, the iOS Keychain and Keystore-protected storage on Android, is designed for secrets, unlike unencrypted key-value stores or plain files. Secrets should never be embedded in source code.$t$, 1, 6) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$In platform secure storage, such as the iOS Keychain or Keystore-protected storage on Android$t$, true, 0),
    (qq, $t$In unencrypted key-value storage such as AsyncStorage or SharedPreferences$t$, false, 1),
    (qq, $t$In a plain text file in the app folder$t$, false, 2),
    (qq, $t$Hard-coded in the app's source code$t$, false, 3);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'multiple_choice', $t$A screen loads its data from an API. Which states should it be designed to handle? Select all that apply.$t$, $t$Every API call can be loading, succeed with data, succeed with nothing, fail or be made while offline. Designing for each prevents blank screens and crashes.$t$, 1, 7) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Loading$t$, true, 0),
    (qq, $t$An error, with a way to retry$t$, true, 1),
    (qq, $t$An empty result$t$, true, 2),
    (qq, $t$No network connection$t$, true, 3),
    (qq, $t$None besides success, because API errors are rare$t$, false, 4);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'true_false', $t$If your app lets users create an account, both Apple and Google expect you to provide a way for users to request deletion of that account.$t$, $t$True. Both stores expect apps that support account creation to offer account deletion. Check the current official requirements for the details of how it must work.$t$, 1, 8) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, 'True', true, 0),
    (qq, 'False', false, 1);

  insert into public.quiz_questions (course_id, quiz_id, question_type, prompt, explanation, points, sort_order)
    values (c, qz, 'single_choice', $t$You are releasing an update on Google Play and want to limit the impact of any new bug. What should you do?$t$, $t$A staged rollout releases the update to a percentage of users first, so you can watch crash reports and feedback before releasing to everyone.$t$, 1, 9) returning id into qq;
  insert into public.quiz_options (question_id, label, is_correct, sort_order) values
    (qq, $t$Use a staged rollout to a percentage of users first$t$, true, 0),
    (qq, $t$Release to all users at once to get feedback faster$t$, false, 1),
    (qq, $t$Skip the testing tracks to save time$t$, false, 2),
    (qq, $t$Turn off crash reporting so fewer problems are reported$t$, false, 3);

  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Course quiz', 'Ten questions covering every module.', 'quiz', 2, 10, false, 'quiz_passed') returning id into l;
  update public.quizzes set lesson_id = l where id = qz;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, quiz_id, data)
    values (l, c, 'quiz', 0, qz, jsonb_build_object('intro', $t$Ten questions covering planning, mobile design, core building blocks, data, testing and publishing. You need 70% to pass, and you will see the correct answers with explanations after you submit.$t$));

  -- Module 5 assignment lesson
  insert into public.assignments (course_id, title, instructions, max_points, passing_points, submission_types, rubric, status, counts_toward_completion)
    values (c, 'App specification, prototype and release plan', $h$<p>In this assignment you will take an app idea from problem to a publish-ready plan. You will produce a product specification, a tested prototype and a release plan. Use your own idea, or design a simple app for a local business or community group.</p>
<h2>What to submit</h2>
<p>Submit one document (PDF or DOCX) or a link to a shared folder, plus a link to your prototype or code repository. Include the four parts below.</p>
<h3>Part 1: Product specification</h3>
<ul>
<li>Problem statement, primary user and the context in which they will use the app.</li>
<li>Core tasks and must-have features, with a clear out-of-scope list.</li>
<li>Your chosen approach (native, cross-platform or web) and the reasons for it.</li>
</ul>
<h3>Part 2: User flows and prototype</h3>
<ul>
<li>User flows for at least two core tasks, including empty and error cases.</li>
<li>A clickable prototype or working build covering those flows. A coded prototype in React Native, Flutter or native code is welcome but not required.</li>
<li>Notes from testing the prototype with at least three people, and the changes you made as a result.</li>
</ul>
<h3>Part 3: Technical plan</h3>
<ul>
<li>A navigation map showing tabs, stacks and modals.</li>
<li>A state and data plan: what lives where, which APIs you need, what is stored on the device and how sensitive data is protected.</li>
<li>A testing plan covering automated tests and manual checks on real devices.</li>
</ul>
<h3>Part 4: Release and growth plan</h3>
<ul>
<li>A store listing draft: name, short description and a plan for screenshots.</li>
<li>Privacy notes: the data you collect, the permissions you request and why.</li>
<li>A post-launch plan with three metrics and how you will gather feedback.</li>
</ul>
<h2>Guidelines</h2>
<ul>
<li>Keep the scope realistic for a first version.</li>
<li>Base your store and privacy notes on the current official guidelines, and name the sections you checked.</li>
<li>Do not include real personal data in your prototype; use realistic sample data instead.</li>
</ul>$h$, 100, 60, '{text,file,link}',
      jsonb_build_array(
        jsonb_build_object('id','c1','criterion',$t$Product definition$t$,'description',$t$A clear problem, primary user and focused MVP scope, with a justified choice of technical approach.$t$,'points',30),
        jsonb_build_object('id','c2','criterion',$t$UX, flows and prototype$t$,'description',$t$Flows cover core tasks and edge cases; the prototype follows mobile UX principles, platform conventions and accessibility basics, with evidence of user testing.$t$,'points',30),
        jsonb_build_object('id','c3','criterion',$t$Technical plan$t$,'description',$t$Navigation, state, data, storage, security and testing decisions are sensible and clearly explained.$t$,'points',20),
        jsonb_build_object('id','c4','criterion',$t$Release and iteration readiness$t$,'description',$t$The store listing, privacy notes and post-launch metrics are realistic and grounded in the official store guidelines.$t$,'points',20)),
      'published', false) returning id into asg;
  insert into public.lessons (course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, completion_rule)
    values (c, m, 'Practical assignment', $t$Turn your idea into a product specification, a tested prototype and a release plan.$t$, 'assignment', 3, 30, false, 'manual') returning id into l;
  update public.assignments set lesson_id = l where id = asg;
  insert into public.lesson_content_blocks (lesson_id, course_id, block_type, sort_order, assignment_id, data)
    values (l, c, 'assignment', 0, asg, jsonb_build_object('intro', $t$Bring the whole course together: specify your app, prototype and test its core flows, and plan its release and first improvements.$t$));
end $$;
