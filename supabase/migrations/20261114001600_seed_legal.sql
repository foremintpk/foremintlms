-- Initial legal document drafts (version 1). Placeholders in double braces
-- ({{entity_name}}, {{business_address}}, {{support_email}}, {{jurisdiction}},
-- {{site_url}}, {{registration_number}}) are filled from platform settings
-- when the page is rendered. These drafts MUST be reviewed by a qualified
-- lawyer against the actual operating entity, Whop's terms and the consumer
-- laws of every market the academy sells into before being relied upon.

insert into public.legal_documents (slug, title) values
  ('terms', 'Terms and Conditions'),
  ('privacy', 'Privacy Policy'),
  ('refund', 'Refund and Cancellation Policy'),
  ('cookies', 'Cookie Policy')
on conflict (slug) do nothing;

insert into public.legal_document_versions (document_id, version, body, change_summary, status, published_at)
select d.id, 1, v.body, 'Initial draft for legal review', 'published', now()
from public.legal_documents d
join (values
('terms', $terms$
<div data-legal-review-notice>This document is an initial draft prepared for legal review. It does not yet reflect advice from a qualified lawyer and must be reviewed against the operating entity, payment-provider terms and applicable consumer law before it is relied upon.</div>

<h2>1. About these terms</h2>
<p>These Terms and Conditions ("Terms") govern your use of the Foremint Academy website, learning platform, courses, live sessions, communities and related services (together, the "Services") operated by {{entity_name}} ("Foremint Academy", "we", "us"), registered at {{business_address}}{{registration_number}}.</p>
<p>By creating an account, purchasing a course or otherwise using the Services, you agree to these Terms, our <a href="/legal/privacy">Privacy Policy</a> and our <a href="/legal/refund">Refund and Cancellation Policy</a>. If you do not agree, do not use the Services.</p>

<h2>2. Eligibility</h2>
<p>You must be at least 18 years old, or the age of majority where you live, to create an account or make a purchase. If you are between 13 and 18, you may use the Services only with the involvement and consent of a parent or legal guardian who accepts these Terms on your behalf. The Services are not directed to children under 13.</p>
<p>You may not use the Services if you are prohibited from doing so under applicable law, including sanctions laws.</p>

<h2>3. Your account</h2>
<p>To access most features you need an account. You agree to provide accurate information, keep it up to date and keep your login credentials confidential. You are responsible for activity that happens under your account. Tell us immediately at {{support_email}} if you suspect unauthorised access.</p>
<p>Accounts are personal. You may not share, sell or transfer your account or allow others to access courses through it.</p>

<h2>4. Account security</h2>
<p>Use a strong, unique password and keep your email account secure, because it is used to verify your identity and reset your password. Administrators and instructors may be required to use multi-factor authentication. We may require additional verification, sign you out of sessions or temporarily restrict access if we detect suspicious activity.</p>

<h2>5. Permitted use</h2>
<p>Subject to these Terms and payment of any applicable fees, we grant you a limited, personal, non-exclusive, non-transferable, revocable licence to access and view the courses you are entitled to, for your own personal learning and, where a course says so, for use of its templates and resources in your own business.</p>

<h2>6. Prohibited activity</h2>
<p>You must not:</p>
<ul>
<li>copy, download (other than through download features we provide), record, screen-capture, reproduce, distribute, resell, publicly display or share course content;</li>
<li>share your login, course access or private links with anyone else;</li>
<li>circumvent or attempt to circumvent access controls, video protection, drip schedules or payment systems;</li>
<li>use bots, scrapers or automated tools to access or extract content;</li>
<li>upload malware or content that is unlawful, infringing, defamatory, harassing, hateful or sexually explicit;</li>
<li>harass, threaten or impersonate other learners, instructors or staff;</li>
<li>use the Services to send spam or unsolicited promotions;</li>
<li>interfere with the security, integrity or performance of the Services.</li>
</ul>

<h2>7. Course access</h2>
<p>The access you receive depends on the plan you buy, which is described at the point of purchase:</p>
<ul>
<li><strong>Fixed-term access</strong> (for example 30, 60 or 90 days) begins when your enrollment is confirmed and ends at the time shown in your dashboard.</li>
<li><strong>Lifetime access</strong> lasts for as long as we operate the Services and the course remains available, subject to these Terms.</li>
<li><strong>Subscriptions and memberships</strong> give access while your subscription remains active and paid.</li>
<li><strong>Free courses and previews</strong> may be changed or withdrawn at any time.</li>
</ul>
<p>Access is granted only after your payment is confirmed by our payment provider. Some lessons may be released on a schedule ("drip content") or require earlier lessons to be completed first. We may update, reorganise or replace course content to keep it accurate and useful. If we permanently retire a course you bought with lifetime access, we will give reasonable notice and, where required by law, offer an appropriate remedy.</p>

<h2>8. Intellectual property</h2>
<p>All content on the Services — including videos, text, graphics, templates, quizzes, software, logos and trademarks — is owned by us, our instructors or our licensors and is protected by intellectual property laws. Except for the licence in section 5, no rights are granted to you.</p>

<h2>9. Instructor content</h2>
<p>Some courses are created by independent instructors. Instructors are responsible for the accuracy of their content and for having the rights to publish it. We review courses before publication but do not guarantee that instructor content is complete, current or error-free.</p>

<h2>10. Content you submit</h2>
<p>You keep ownership of assignments, discussion posts, messages, reviews and other content you submit ("Your Content"). You grant us a worldwide, non-exclusive, royalty-free licence to host, store, display and process Your Content to operate the Services — for example, so instructors can grade your assignments and other learners can read your discussion posts. You confirm that you have the right to submit Your Content and that it does not infringe anyone else's rights. We will only use your name, image or story in marketing (such as testimonials or case studies) with your separate, explicit permission.</p>

<h2>11. Community conduct</h2>
<p>Course discussions and communities are for respectful, on-topic learning. Do not post personal information about others, promotional content or anything that breaches section 6. Instructors and administrators may moderate, hide or remove content and may restrict access to community features.</p>

<h2>12. Messages and moderation</h2>
<p>Private messaging lets you contact your instructors and our team. Messages may be reviewed by administrators to investigate reports of abuse, enforce these Terms or meet legal obligations. Do not use messages to share login details, payment information or sensitive personal data.</p>

<h2>13. Payments</h2>
<p>Prices are shown at checkout and may include or exclude taxes depending on your location. Payments are processed by our payment provider, Whop, and are also subject to Whop's terms. We do not store your full payment card details. You authorise the payment provider to charge the payment method you supply for the selected plan. If a payment is reversed, disputed or charged back, we may suspend the related access while the matter is resolved.</p>

<h2>14. Subscription renewals</h2>
<p>Subscriptions renew automatically at the end of each billing period at the then-current price unless you cancel before the renewal date. We will tell you about price changes before they take effect, as required by law. If a renewal payment fails, we may retry the payment and may suspend access after any grace period shown in your account.</p>

<h2>15. Cancellation</h2>
<p>You can cancel a subscription at any time from your billing page or by contacting {{support_email}}. Cancellation stops future renewals; unless stated otherwise or required by law, access continues until the end of the period you have already paid for. Refunds are handled under our <a href="/legal/refund">Refund and Cancellation Policy</a>. You may close your account at any time by contacting us.</p>

<h2>16. Suspension and termination</h2>
<p>We may suspend or terminate your account or access, with notice where practical, if you breach these Terms, if required by law, if a payment is reversed or fraudulent, or if your use creates risk for us or other users. Where we terminate for reasons other than your breach, we will offer a pro-rata refund of prepaid fees for access you will no longer receive, where required by law.</p>

<h2>17. Educational disclaimer</h2>
<p>Our courses provide general education. They are not legal, tax, financial, accounting or other professional advice. Company formation, tax and regulatory content in particular varies by country and changes over time; consult a qualified professional before acting on it.</p>

<h2>18. No guaranteed outcomes</h2>
<p>We do not guarantee any business, income, employment, ranking or sales outcome. Any examples of results are illustrative of what particular individuals achieved and are not typical or promised. Your results depend on many factors outside our control, including your effort, skills, capital, market conditions and the policies of third-party platforms such as Amazon, eBay, Shopify and Google.</p>

<h2>19. Third-party services</h2>
<p>The Services integrate with third parties such as Whop (payments), Zoom and Google Meet (live classes) and video hosting providers. Your use of those services may be subject to their terms. We are not responsible for third-party services we do not control.</p>

<h2>20. Limitation of liability</h2>
<p>Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law, including liability for death or personal injury caused by negligence, fraud, or your statutory rights as a consumer. Subject to that, and to the maximum extent permitted by law: (a) we are not liable for indirect, incidental, special or consequential losses, or for loss of profits, revenue, business or data; and (b) our total liability arising out of or relating to the Services is limited to the amount you paid us in the 12 months before the event giving rise to the claim.</p>

<h2>21. Disputes</h2>
<p>If you have a complaint, contact us first at {{support_email}} so we can try to resolve it informally. We aim to respond within 14 days. If we cannot resolve it, either party may pursue the remedies available under applicable law. Consumers may also have the right to use an alternative dispute resolution body or bring proceedings in the courts where they live.</p>

<h2>22. Governing law and jurisdiction</h2>
<p>These Terms are governed by the laws of {{jurisdiction}}, and the courts of {{jurisdiction}} have jurisdiction, without depriving consumers of the protection of mandatory laws of the country where they live or of their right to bring proceedings there.</p>

<h2>23. Changes to these terms</h2>
<p>We may update these Terms to reflect changes in the Services or the law. We will post the new version with its effective date and, for material changes, notify you by email or in your dashboard before they apply. Previous versions remain available on this page.</p>

<h2>24. Contact</h2>
<p>{{entity_name}}<br>{{business_address}}<br>Email: {{support_email}}</p>
$terms$),
('privacy', $privacy$
<div data-legal-review-notice>This document is an initial draft prepared for legal review. It must be reviewed against the operating entity's actual data practices, the jurisdictions where it operates (for example GDPR/UK GDPR, CCPA/CPRA) and its processor agreements before it is relied upon.</div>

<h2>1. Who we are</h2>
<p>This Privacy Policy explains how {{entity_name}} ("Foremint Academy", "we", "us"), of {{business_address}}, collects and uses personal information when you use our website and learning platform (the "Services"). For the purposes of data-protection law, we are the controller of the personal information described here. Contact us at {{support_email}}.</p>

<h2>2. Information we collect</h2>
<h3>Account and identity data</h3>
<p>Name, email address, password (stored only as a secure hash by our authentication provider), profile photo, headline, bio, time zone, country, phone number if you provide one, and your role on the platform (student, instructor or administrator).</p>
<h3>Learning activity</h3>
<p>Courses you enroll in, lessons viewed, video playback position, progress and completion, quiz attempts and scores, assignment submissions and grades, certificates, bookmarks and personal notes, live-class registration and attendance, discussion posts, reactions and reviews.</p>
<h3>Communications</h3>
<p>Private messages, support tickets and their attachments, contact-form enquiries and newsletter preferences.</p>
<h3>Payment-related data</h3>
<p>Plan purchased, amount, currency, taxes, transaction and membership identifiers, payment status, refund and dispute status, billing name and address where provided, and the card brand and last four digits returned by our payment provider. We do not receive or store your full card number or security code.</p>
<h3>Technical and device data</h3>
<p>IP address, browser and device type, operating system, session identifiers, sign-in times, and security logs used to protect your account. With your consent, we also collect analytics about how the website is used.</p>

<h2>3. Cookies and similar technologies</h2>
<p>We use strictly necessary cookies to keep you signed in, secure your session and remember your cookie choices. With your consent, we use analytics cookies to understand how the site is used. You can change your choices at any time from the "Cookie preferences" link in the footer. See our <a href="/legal/cookies">Cookie Policy</a>.</p>

<h2>4. How we use your information</h2>
<ul>
<li>To create and manage your account and authenticate you.</li>
<li>To process purchases, grant and manage course access, and keep billing records.</li>
<li>To deliver courses, track progress, grade assessments and issue certificates.</li>
<li>To run live classes and record attendance.</li>
<li>To enable messages, discussions and support.</li>
<li>To send transactional emails such as receipts, password resets and class reminders.</li>
<li>To send marketing emails, only where you have agreed or where the law allows and you have not opted out.</li>
<li>To secure the Services, prevent fraud and abuse, and enforce our Terms.</li>
<li>To improve the Services using aggregated analytics.</li>
<li>To meet legal, tax and accounting obligations.</li>
</ul>

<h2>5. Legal bases (where GDPR or UK GDPR applies)</h2>
<ul>
<li><strong>Contract</strong> — to provide the Services you sign up for and purchase.</li>
<li><strong>Legitimate interests</strong> — to secure the platform, prevent fraud, improve our courses and communicate about the Services, balanced against your rights.</li>
<li><strong>Consent</strong> — for analytics cookies and certain marketing; you can withdraw consent at any time.</li>
<li><strong>Legal obligation</strong> — to keep financial records and respond to lawful requests.</li>
</ul>

<h2>6. Who we share information with</h2>
<p>We share personal information only with service providers that help us run the Services, under contracts that require them to protect it, and only as needed:</p>
<ul>
<li><strong>Supabase</strong> — database, authentication and file storage.</li>
<li><strong>Vercel</strong> — website hosting and delivery.</li>
<li><strong>Whop</strong> — payment processing, subscriptions, receipts and invoices. Whop processes payment details under its own privacy policy.</li>
<li><strong>Resend</strong> — delivery of transactional emails.</li>
<li><strong>Zoom</strong> and <strong>Google (Google Meet)</strong> — hosting live classes; when you join, these providers process your participation data under their own privacy policies.</li>
<li><strong>Video hosting providers</strong> (such as Mux, Bunny.net or YouTube, depending on the course) — streaming lesson videos.</li>
<li><strong>Analytics providers</strong> — only if you consent.</li>
</ul>
<p>Instructors can see the names, progress, submissions and messages of students enrolled in their courses. Other learners in a course can see your name, profile photo and the content you post in course discussions. We may also disclose information if required by law, to protect rights and safety, or as part of a business transfer.</p>
<p>We do not sell your personal information.</p>

<h2>7. International transfers</h2>
<p>Our service providers may process information in countries other than yours, including the United States. Where required, we rely on appropriate safeguards such as the European Commission's Standard Contractual Clauses or equivalent mechanisms.</p>

<h2>8. How long we keep information</h2>
<ul>
<li>Account and learning records — for as long as your account is active, and then for up to 24 months unless you ask us to delete them sooner.</li>
<li>Certificates — for as long as needed to allow verification, unless you ask us to revoke and delete them.</li>
<li>Billing and transaction records — for the period required by tax and accounting law (typically 6–10 years).</li>
<li>Support tickets and messages — up to 36 months after the last activity.</li>
<li>Security logs — up to 12 months.</li>
</ul>

<h2>9. How we protect information</h2>
<p>We use encryption in transit, encrypted storage of sensitive integration credentials, role-based access controls enforced in our database, multi-factor authentication for administrators, private file storage with time-limited links, and audit logs of sensitive administrative actions. No system is perfectly secure, but we work to protect your information and review our safeguards regularly.</p>

<h2>10. Your rights</h2>
<p>Depending on where you live, you may have the right to access, correct, delete or export your personal information, to restrict or object to certain processing, to withdraw consent, and to complain to a data-protection authority. California residents may have additional rights under the CCPA/CPRA, including the right to know and to delete, and we will not discriminate against you for exercising them. To make a request, email {{support_email}}. We may need to verify your identity before acting on a request.</p>

<h2>11. Account deletion</h2>
<p>You can ask us to delete your account at any time from your account settings or by emailing {{support_email}}. We will delete or anonymise your personal information within 30 days, except where we must keep certain records (such as transaction records) by law.</p>

<h2>12. Security incidents</h2>
<p>If a personal-data breach is likely to put your rights at risk, we will notify you and the relevant authorities as required by law, and explain what happened and what we are doing about it.</p>

<h2>13. Children</h2>
<p>The Services are not directed to children under 13, and we do not knowingly collect their personal information. If you believe a child has provided us information, contact us and we will delete it.</p>

<h2>14. Changes</h2>
<p>We will post updates to this policy with a new effective date and notify you of material changes.</p>

<h2>15. Contact</h2>
<p>{{entity_name}}<br>{{business_address}}<br>Email: {{support_email}}</p>
$privacy$),
('refund', $refund$
<div data-legal-review-notice>This policy is an initial draft prepared for legal review. It is intended to work alongside — never to override — the mandatory consumer rights that apply where a customer lives, and it must be checked against the payment provider's terms.</div>

<h2>1. Your statutory rights</h2>
<p>Nothing in this policy limits rights you have under the consumer protection law of the country where you live. Where that law gives you more protection than this policy, the law applies.</p>

<h2>2. How to request a refund</h2>
<p>Open a support ticket from your dashboard (category "Billing") or email {{support_email}} with the email address on your account, the course or plan, the date of purchase and the reason for your request. We acknowledge refund requests within 2 business days.</p>

<h2>3. When refunds are available</h2>
<ul>
<li><strong>Within 14 days of purchase</strong>, if you have completed less than 20% of the course and have not downloaded its downloadable resources or received a certificate, we will refund a one-time course purchase in full.</li>
<li><strong>Technical problems</strong> that prevent you from accessing the course, which we cannot fix within a reasonable time.</li>
<li><strong>Content not as described</strong> — if a course materially differs from its description.</li>
<li><strong>Duplicate payments</strong> — if you were charged twice for the same item, we refund the duplicate in full.</li>
<li><strong>Incorrect purchases</strong> — if you bought the wrong plan or course and contact us within 7 days without substantially using it, we will refund or switch you to the right one.</li>
<li><strong>Unauthorised or fraudulent transactions</strong> — contact us immediately; we will investigate with our payment provider and refund confirmed fraudulent charges.</li>
</ul>

<h2>4. Digital content and course consumption</h2>
<p>Courses are digital content delivered immediately. In some countries (for example in the EU and UK) you have a 14-day right to cancel online purchases, but that right can end once you start accessing digital content after expressly agreeing to immediate access and acknowledging that you lose the right to cancel. Where the law gives you that right and it has not ended, we will honour it.</p>
<p>When considering requests outside the cases above, we take into account how much of the course has been viewed or downloaded. Substantial consumption of a course (for example, more than 20% of lessons completed or resources downloaded) may mean a refund is not available, except where required by law.</p>

<h2>5. Subscriptions and recurring payments</h2>
<ul>
<li>You can cancel a subscription at any time from your billing page. Cancellation stops future renewals.</li>
<li>After you cancel, you keep access until the end of the billing period you have already paid for. We do not normally refund partial periods, except where required by law.</li>
<li>If you are charged for a renewal you did not intend and contact us within 7 days of the renewal date without having used the subscription during that new period, we will refund the renewal.</li>
<li>Free trials convert to paid subscriptions at the end of the trial unless you cancel before then; the trial length and price are shown at checkout.</li>
</ul>

<h2>6. Failed payments</h2>
<p>If a payment fails, you are not charged and no refund is needed. For subscriptions, our payment provider may retry the payment; access may be paused until payment succeeds. You can update your payment method from your billing page.</p>

<h2>7. Review timeline and processing</h2>
<p>We aim to decide on refund requests within 5 business days. Approved refunds are issued through our payment provider, Whop, to the original payment method. Banks typically take 5–10 business days to show the refund. When a refund is issued, access to the refunded course or plan ends.</p>

<h2>8. Payment-provider involvement</h2>
<p>Payments are processed by Whop. Refunds are issued through Whop's systems and may also be subject to its policies. If you open a dispute or chargeback with your bank, access may be suspended while it is resolved; contacting us first is usually the fastest way to sort out a problem.</p>

<h2>9. Contact</h2>
<p>{{entity_name}}<br>{{business_address}}<br>Email: {{support_email}}</p>
$refund$),
('cookies', $cookies$
<div data-legal-review-notice>This document is an initial draft prepared for legal review.</div>

<h2>1. What cookies are</h2>
<p>Cookies are small files stored by your browser. We also use similar technologies such as local storage. This policy explains which ones we use and how to control them.</p>

<h2>2. Strictly necessary</h2>
<p>These keep you signed in, protect your session and requests from forgery, remember your cookie choices and keep the platform secure. They cannot be switched off because the Services do not work without them.</p>

<h2>3. Preferences</h2>
<p>These remember choices such as light or dark mode and video playback speed.</p>

<h2>4. Analytics (optional)</h2>
<p>With your consent we use analytics tools to understand which pages are used and how the site performs. They are not loaded until you allow them.</p>

<h2>5. Third-party content</h2>
<p>Some lessons and live classes embed content from providers such as YouTube, Mux, Bunny.net, Zoom or Google. These providers may set their own cookies when you play their content, under their own policies.</p>

<h2>6. Managing your choices</h2>
<p>Use the "Cookie preferences" link in the website footer to change your choices at any time. You can also delete cookies through your browser settings.</p>

<h2>7. Contact</h2>
<p>Questions? Email {{support_email}}.</p>
$cookies$)
) as v(slug, body) on v.slug = d.slug
on conflict (document_id, version) do nothing;

update public.legal_documents d
set current_version_id = v.id
from public.legal_document_versions v
where v.document_id = d.id and v.version = 1 and d.current_version_id is null;
