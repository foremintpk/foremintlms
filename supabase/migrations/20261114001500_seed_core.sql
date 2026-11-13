-- Seed data that every environment needs: categories, draft course shells,
-- platform settings, email templates, editable CMS content and FAQs.
-- No testimonials, reviews, case studies or revenue figures are seeded.

insert into public.course_categories (slug, name, short_description, image_url, icon, accent_color, sort_order, status)
values
  ('amazon-fba', 'Amazon FBA', 'Research, source, list and scale products sold through Fulfilled by Amazon.', '/images/categories/amazon-fba.jpg', 'package', '#F5A524', 1, 'published'),
  ('e-commerce', 'E-commerce', 'Build, launch and run an online store that customers trust and return to.', '/images/categories/e-commerce.jpg', 'shopping-bag', '#5B3DF5', 2, 'published'),
  ('ebay-selling', 'eBay Selling', 'List, price, ship and grow a profitable eBay selling operation.', '/images/categories/ebay-selling.jpg', 'tag', '#0EA5E9', 3, 'published'),
  ('llc-ltd-formation', 'LLC & LTD Formation', 'Set up and maintain a US LLC or UK LTD company for your online business.', '/images/categories/llc-ltd-formation.jpg', 'landmark', '#0E9F6E', 4, 'published'),
  ('shopify', 'Shopify', 'Design, configure and market a Shopify store that converts.', '/images/categories/shopify.jpg', 'store', '#3DDC97', 5, 'published'),
  ('wordpress-development', 'WordPress Development', 'Build fast, maintainable WordPress sites, themes and plugins.', '/images/categories/wordpress-development.jpg', 'layout-template', '#2563EB', 6, 'published'),
  ('complete-seo-framework', 'Complete SEO Framework', 'Technical, on-page and content SEO you can apply to any website.', '/images/categories/complete-seo-framework.jpg', 'search', '#7C5CFF', 7, 'published'),
  ('web-development', 'Web Development', 'Modern front-end and back-end development for real-world projects.', '/images/categories/web-development.jpg', 'code', '#14112B', 8, 'published'),
  ('app-development', 'App Development', 'Design and ship mobile apps for iOS and Android.', '/images/categories/app-development.jpg', 'smartphone', '#EC4899', 9, 'published'),
  ('digital-marketing', 'Digital Marketing', 'Plan and run campaigns across social, search, email and content.', '/images/categories/digital-marketing.jpg', 'megaphone', '#F97316', 10, 'published')
on conflict (slug) do nothing;

-- Draft course shells. They stay unpublished until real course material is
-- added and an administrator approves them.
insert into public.courses (slug, title, short_description, category_id, level, status, visibility, thumbnail_url)
select v.slug, v.title, v.short_description, c.id, v.level, 'draft', 'public', c.image_url
from (values
  ('amazon-fba-foundations', 'Amazon FBA Foundations', 'From product research to your first Fulfilled by Amazon shipment.', 'amazon-fba', 'beginner'),
  ('e-commerce-business-essentials', 'E-commerce Business Essentials', 'The operating basics of an online store: product, pricing, fulfilment and service.', 'e-commerce', 'beginner'),
  ('ebay-selling-playbook', 'eBay Selling Playbook', 'Sourcing, listing, pricing and shipping on eBay.', 'ebay-selling', 'beginner'),
  ('llc-and-ltd-formation-guide', 'LLC & LTD Formation Guide', 'Choosing, forming and maintaining a company for an online business.', 'llc-ltd-formation', 'beginner'),
  ('shopify-store-launch', 'Shopify Store Launch', 'Set up, design and launch a Shopify store.', 'shopify', 'beginner'),
  ('wordpress-development-fundamentals', 'WordPress Development Fundamentals', 'Themes, blocks and plugins for professional WordPress builds.', 'wordpress-development', 'intermediate'),
  ('complete-seo-framework', 'Complete SEO Framework', 'A repeatable process for technical, on-page and content SEO.', 'complete-seo-framework', 'all_levels'),
  ('modern-web-development', 'Modern Web Development', 'HTML, CSS, JavaScript and a modern framework, project by project.', 'web-development', 'beginner'),
  ('mobile-app-development', 'Mobile App Development', 'Plan, build and publish your first mobile app.', 'app-development', 'beginner'),
  ('digital-marketing-fundamentals', 'Digital Marketing Fundamentals', 'Plan campaigns across social, search, email and content.', 'digital-marketing', 'beginner')
) as v(slug, title, short_description, category_slug, level)
join public.course_categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

insert into public.platform_settings (key, value, description, is_public) values
  ('brand.name', '"Foremint Academy"', 'Brand name shown across the site, emails and documents.', true),
  ('brand.tagline', '"Build Skills. Create Opportunities. Grow Beyond Limits."', 'Primary tagline.', true),
  ('brand.primary_color', '"#5B3DF5"', 'Primary brand colour used in emails, certificates and invoices.', true),
  ('brand.accent_color', '"#3DDC97"', 'Accent colour used for progress and success states.', true),
  ('brand.logo_url', '""', 'Optional uploaded logo (leave empty to use the built-in mark).', true),
  ('contact.support_email', '""', 'Support address shown to customers.', true),
  ('contact.phone', '""', 'Optional phone number shown on the contact page.', true),
  ('contact.social_links', '{}', 'Social profile URLs, e.g. {"linkedin": "https://…"}.', true),
  ('legal.entity_name', '""', 'Registered legal entity that operates the academy.', true),
  ('legal.business_address', '""', 'Registered business address.', true),
  ('legal.jurisdiction', '""', 'Governing law and jurisdiction for the terms.', true),
  ('legal.registration_number', '""', 'Company registration number, if applicable.', true),
  ('legal.tax_id', '""', 'Tax / VAT registration number, only if registered.', false),
  ('billing.default_currency', '"usd"', 'Default currency for new pricing plans.', false),
  ('billing.invoice_footer', '""', 'Extra text printed at the bottom of Foremint-branded receipts.', false),
  ('billing.send_foremint_receipts', 'false', 'Also email a Foremint receipt when Whop already sends its own.', false),
  ('billing.default_grace_period_days', '3', 'Days a recurring entitlement stays valid after a missed renewal.', false),
  ('security.require_admin_mfa', 'true', 'Require administrators to verify with an authenticator app.', false),
  ('security.allow_google_login', 'false', 'Show "Continue with Google" on login and registration.', true),
  ('messaging.students_can_message_any_teacher', 'false', 'Allow students to message any approved teacher, not just their own.', false),
  ('uploads.limits_mb', '{"course_content": 200, "submission": 25, "attachment": 10, "image": 5}', 'Maximum upload size per purpose in megabytes.', false),
  ('uploads.allowed_extensions', '{"course_content": ["pdf","docx","pptx","xlsx","png","jpg","jpeg","webp","zip","txt","csv","mp3"], "submission": ["pdf","docx","pptx","xlsx","png","jpg","jpeg","webp","zip","txt"], "attachment": ["pdf","docx","png","jpg","jpeg","webp","txt"]}', 'Allowed file extensions per purpose.', false),
  ('email.sender_name', '"Foremint Academy"', 'Display name on outgoing email.', false),
  ('email.from_address', '""', 'From address (must be on a domain verified in Resend). Falls back to EMAIL_FROM.', false),
  ('email.reply_to', '""', 'Reply-to address for transactional email.', false),
  ('live.reminder_offsets_minutes', '[1440, 60]', 'When to remind students before a live class.', false),
  ('learning.access_expiry_reminder_days', '7', 'Days before access expires to send a reminder.', false),
  ('analytics.ga_measurement_id', '""', 'Google Analytics 4 measurement ID (loaded only after consent).', true),
  ('analytics.plausible_domain', '""', 'Plausible Analytics domain (loaded only after consent).', true)
on conflict (key) do nothing;

insert into public.integration_settings (provider) values
  ('whop'), ('resend'), ('mux'), ('bunny'), ('youtube'), ('zoom'), ('google')
on conflict (provider) do nothing;

insert into public.email_templates (key, name, category, subject, preheader, heading, body, cta_label, is_required) values
  ('auth.verify_email', 'Verify email', 'auth', 'Confirm your email for {{brand_name}}', 'One click to activate your account.', 'Confirm your email address', 'Hi {{first_name}},

Confirm this email address to activate your {{brand_name}} account. The link expires in 24 hours.

If you did not create an account, you can ignore this email.', 'Confirm email', true),
  ('auth.welcome', 'Welcome', 'auth', 'Welcome to {{brand_name}}', 'Your account is ready.', 'Welcome to {{brand_name}}', 'Hi {{first_name}},

Your account is ready. Browse the course catalogue, choose a learning plan and pick up exactly where you leave off on any device.', 'Explore courses', false),
  ('auth.password_reset', 'Password reset', 'auth', 'Reset your {{brand_name}} password', 'This link expires in 1 hour.', 'Reset your password', 'Hi {{first_name}},

We received a request to reset your password. Use the button below to choose a new one. The link expires in 1 hour.

If you did not ask for this, ignore this email — your password will not change.', 'Choose a new password', true),
  ('auth.password_changed', 'Password changed', 'auth', 'Your {{brand_name}} password was changed', 'Security notice for your account.', 'Your password was changed', 'Hi {{first_name}},

The password for your account was changed on {{changed_at}}.

If you made this change, no action is needed. If you did not, reset your password immediately and contact support.', 'Review account security', true),
  ('auth.new_account_security', 'New sign-in', 'auth', 'New sign-in to your {{brand_name}} account', 'A new device signed in.', 'New sign-in detected', 'Hi {{first_name}},

Your account was signed in to from a new device on {{signed_in_at}}.

If this was you, no action is needed. If not, change your password and sign out other sessions from your account settings.', 'Review sessions', true),
  ('auth.teacher_invitation', 'Instructor invitation', 'auth', 'You are invited to teach on {{brand_name}}', 'Accept your instructor invitation.', 'You are invited to teach', 'Hi {{first_name}},

{{inviter_name}} invited you to join {{brand_name}} as an instructor.

{{message}}

The invitation expires on {{expires_at}}.', 'Accept invitation', true),
  ('system.teacher_approved', 'Instructor approved', 'system', 'Your instructor account is approved', 'You can now manage your courses.', 'Your instructor account is approved', 'Hi {{first_name}},

Your instructor account on {{brand_name}} has been approved. You can now manage your assigned courses from the teaching dashboard.', 'Open teaching dashboard', false),
  ('billing.payment_confirmation', 'Payment confirmation', 'billing', 'Payment received — {{product_name}}', 'Thanks for your purchase.', 'Payment received', 'Hi {{first_name}},

Thanks for your purchase. Your payment for {{product_name}} has been confirmed.', 'View receipt', false),
  ('billing.enrollment_confirmation', 'Enrollment confirmation', 'billing', 'You are enrolled in {{course_title}}', 'Start learning now.', 'You are enrolled', 'Hi {{first_name}},

You now have access to {{course_title}}. {{access_summary}}', 'Start learning', false),
  ('billing.receipt_available', 'Receipt available', 'billing', 'Your receipt {{document_number}} is ready', 'Download it from your billing page.', 'Your receipt is ready', 'Hi {{first_name}},

Receipt {{document_number}} for {{product_name}} is available to download from your billing page.', 'Download receipt', false),
  ('billing.payment_failed', 'Payment failed', 'billing', 'Action needed: payment for {{product_name}} failed', 'Update your payment method to keep access.', 'Your payment did not go through', 'Hi {{first_name}},

We could not process your payment for {{product_name}}. {{failure_reason}}

Update your payment method to keep your access.', 'Update payment method', true),
  ('billing.refund_processed', 'Refund processed', 'billing', 'Your refund for {{product_name}} has been processed', 'Refund details inside.', 'Refund processed', 'Hi {{first_name}},

A refund of {{amount}} for {{product_name}} has been processed. Depending on your bank, it can take 5–10 business days to appear.', 'View billing', false),
  ('billing.subscription_renewed', 'Subscription renewed', 'billing', 'Your {{product_name}} subscription renewed', 'Thanks for staying with us.', 'Subscription renewed', 'Hi {{first_name}},

Your subscription to {{product_name}} renewed successfully. Your next renewal date is {{renews_at}}.', 'View billing', false),
  ('billing.subscription_expiring', 'Subscription ending', 'billing', 'Your {{product_name}} subscription ends on {{ends_at}}', 'Renew to keep your access.', 'Your subscription is ending', 'Hi {{first_name}},

Your subscription to {{product_name}} is set to end on {{ends_at}}. After that date your access to its courses will stop.', 'Manage subscription', false),
  ('billing.access_expiring', 'Access expiring', 'billing', 'Your access to {{course_title}} ends on {{ends_at}}', 'Finish up or extend your access.', 'Your course access ends soon', 'Hi {{first_name}},

Your access to {{course_title}} ends on {{ends_at}}. You have completed {{progress}} of the course.', 'Continue learning', false),
  ('billing.access_expired', 'Access expired', 'billing', 'Your access to {{course_title}} has ended', 'Renew any time to continue.', 'Your course access has ended', 'Hi {{first_name}},

Your access to {{course_title}} ended on {{ended_at}}. Your progress is saved — if you renew, you will continue where you left off.', 'See plans', false),
  ('billing.cancellation_confirmation', 'Cancellation confirmed', 'billing', 'Your {{product_name}} subscription is cancelled', 'Cancellation confirmed.', 'Subscription cancelled', 'Hi {{first_name}},

Your subscription to {{product_name}} has been cancelled. {{access_until}}', 'View billing', false),
  ('learning.course_enrolled', 'Course enrollment', 'learning', 'Welcome to {{course_title}}', 'Your course is ready.', 'Your course is ready', 'Hi {{first_name}},

You have been enrolled in {{course_title}}. Open the course to start the first lesson.', 'Open course', false),
  ('learning.new_course_announcement', 'New course', 'learning', 'New on {{brand_name}}: {{course_title}}', 'A new course is available.', 'A new course is available', 'Hi {{first_name}},

{{course_title}} is now available. {{course_summary}}', 'View course', false),
  ('learning.live_class_scheduled', 'Live class scheduled', 'learning', 'Live class scheduled: {{session_title}}', '{{session_time}}', 'A live class has been scheduled', 'Hi {{first_name}},

{{session_title}} for {{course_title}} is scheduled for {{session_time}} on {{provider_name}}.

{{session_description}}', 'View class details', false),
  ('learning.live_class_reminder', 'Live class reminder', 'learning', 'Starting {{starts_in}}: {{session_title}}', 'Join from your dashboard.', 'Your live class starts {{starts_in}}', 'Hi {{first_name}},

{{session_title}} for {{course_title}} starts at {{session_time}} on {{provider_name}}.', 'Join class', false),
  ('learning.live_class_updated', 'Live class updated', 'learning', 'Updated: {{session_title}}', 'The schedule has changed.', 'A live class has changed', 'Hi {{first_name}},

{{session_title}} for {{course_title}} has been updated. It now takes place {{session_time}} on {{provider_name}}.', 'View class details', false),
  ('learning.live_class_canceled', 'Live class cancelled', 'learning', 'Cancelled: {{session_title}}', 'This class will not take place.', 'A live class was cancelled', 'Hi {{first_name}},

{{session_title}} for {{course_title}}, planned for {{session_time}}, has been cancelled. {{reason}}', 'View course', false),
  ('learning.assignment_deadline', 'Assignment deadline', 'learning', 'Due {{due_in}}: {{assignment_title}}', 'Submit before the deadline.', 'An assignment is due soon', 'Hi {{first_name}},

{{assignment_title}} in {{course_title}} is due {{due_at}}.', 'Open assignment', false),
  ('learning.assignment_graded', 'Assignment graded', 'learning', 'Your assignment was reviewed: {{assignment_title}}', 'See your grade and feedback.', 'Your assignment was reviewed', 'Hi {{first_name}},

{{assignment_title}} in {{course_title}} has been reviewed. Status: {{status}}. {{grade_summary}}', 'View feedback', false),
  ('learning.instructor_feedback', 'Instructor feedback', 'learning', 'New feedback from {{instructor_name}}', 'Your instructor left feedback.', 'You have new feedback', 'Hi {{first_name}},

{{instructor_name}} left feedback on {{assignment_title}} in {{course_title}}.', 'Read feedback', false),
  ('learning.certificate_issued', 'Certificate issued', 'learning', 'Your certificate for {{course_title}}', 'Congratulations on completing the course.', 'You earned a certificate', 'Hi {{first_name}},

Congratulations on completing {{course_title}}. Your certificate number is {{certificate_number}} and anyone can verify it online.', 'Download certificate', false),
  ('learning.course_submitted', 'Course submitted for review', 'learning', 'Course submitted for review: {{course_title}}', 'An instructor submitted a course.', 'A course is waiting for review', 'Hi,

{{instructor_name}} submitted {{course_title}} for publication review.', 'Review course', false),
  ('learning.course_review_result', 'Course review result', 'learning', '{{course_title}}: {{review_result}}', 'Review outcome for your course.', 'Your course review is complete', 'Hi {{first_name}},

{{course_title}} was {{review_result}}. {{review_notes}}', 'Open course', false),
  ('communication.new_message', 'New message', 'communication', 'New message from {{sender_name}}', '{{preview}}', 'You have a new message', 'Hi {{first_name}},

{{sender_name}} sent you a message:

"{{preview}}"', 'Reply', false),
  ('communication.discussion_reply', 'Discussion reply', 'communication', 'New reply: {{discussion_title}}', '{{preview}}', 'New reply to a discussion', 'Hi {{first_name}},

{{author_name}} replied to "{{discussion_title}}" in {{course_title}}:

"{{preview}}"', 'View discussion', false),
  ('communication.mention', 'Mention', 'communication', '{{author_name}} mentioned you', '{{preview}}', 'You were mentioned', 'Hi {{first_name}},

{{author_name}} mentioned you in {{course_title}}:

"{{preview}}"', 'View discussion', false),
  ('communication.ticket_created', 'Ticket created', 'communication', '[{{ticket_number}}] We received your request', 'Our team will reply soon.', 'We received your request', 'Hi {{first_name}},

Your support ticket {{ticket_number}} — "{{ticket_subject}}" — has been created. We will reply by email and in your dashboard.', 'View ticket', true),
  ('communication.ticket_replied', 'Ticket reply', 'communication', '[{{ticket_number}}] New reply to your request', '{{preview}}', 'There is a reply to your ticket', 'Hi {{first_name}},

There is a new reply on ticket {{ticket_number}} — "{{ticket_subject}}":

"{{preview}}"', 'View reply', false),
  ('communication.ticket_resolved', 'Ticket resolved', 'communication', '[{{ticket_number}}] Your request was resolved', 'Reply if you need more help.', 'Your request was resolved', 'Hi {{first_name}},

Ticket {{ticket_number}} — "{{ticket_subject}}" — has been marked as resolved. If you still need help, reply from your dashboard to reopen it.', 'View ticket', false),
  ('communication.staff_ticket_alert', 'New ticket (staff)', 'communication', '[{{ticket_number}}] {{ticket_subject}}', 'A ticket needs attention.', 'A support ticket needs attention', 'Hi,

{{requester_name}} opened ticket {{ticket_number}} ({{ticket_priority}} priority): "{{ticket_subject}}".', 'Open ticket', false),
  ('communication.announcement', 'Announcement', 'communication', '{{announcement_title}}', '{{preview}}', '{{announcement_title}}', '{{announcement_body}}', 'Open dashboard', false),
  ('communication.contact_received', 'Contact form (staff)', 'communication', 'New enquiry from {{lead_name}}', '{{preview}}', 'New website enquiry', '{{lead_name}} ({{lead_email}}) wrote:

"{{lead_message}}"', 'View lead', false)
on conflict (key) do nothing;

-- Editable CMS content for the home and about pages. Each section's content
-- is validated by the application against a typed schema.
insert into public.cms_pages (slug, title, seo_title, seo_description) values
  ('home', 'Home', 'Foremint Academy — Practical skills for the digital economy', 'Practical, career-focused courses in e-commerce, Amazon FBA, Shopify, SEO, web and app development and digital marketing.'),
  ('about', 'About', 'About Foremint Academy', 'Why Foremint Academy exists, how we teach and who we teach.')
on conflict (slug) do nothing;

insert into public.cms_sections (page_id, section_key, sort_order, content)
select p.id, s.section_key, s.sort_order, s.content::jsonb
from public.cms_pages p
join (values
  ('home', 'hero', 1, '{"headline": "Build Skills. Create Opportunities. Grow Beyond Limits.", "subheadline": "Practical education for people building businesses, launching digital careers and creating opportunities in the modern economy.", "primaryCta": {"label": "Explore Courses", "href": "/courses"}, "secondaryCta": {"label": "Start Learning", "href": "/register"}, "image": "/images/hero/hero-entrepreneur.jpg"}'),
  ('home', 'featured_courses', 2, '{"title": "Courses built for doing, not just watching", "subtitle": "Each course pairs short lessons with resources and practice so you can apply what you learn the same week.", "limit": 6}'),
  ('home', 'categories', 3, '{"title": "Popular learning categories", "subtitle": "Pick the skill that moves your business or career forward next."}'),
  ('home', 'why', 4, '{"title": "Why learners choose Foremint Academy", "items": [{"icon": "hammer", "title": "Practical by design", "body": "Lessons are built around tasks you will actually do: listing a product, forming a company, shipping a site."}, {"icon": "trending-up", "title": "Industry-relevant skills", "body": "Course content focuses on the tools and platforms businesses use today."}, {"icon": "clock", "title": "Learn on your schedule", "body": "Recorded lessons, saved progress and mobile-friendly learning fit around your work."}, {"icon": "messages-square", "title": "Instructor guidance", "body": "Ask questions in course discussions and message your instructors directly."}, {"icon": "users", "title": "A community of builders", "body": "Learn alongside entrepreneurs, freelancers and creators working on similar goals."}]}'),
  ('home', 'how_it_works', 5, '{"title": "How learning works", "steps": [{"title": "Discover a course", "body": "Browse by category or learning path and preview lessons before you commit."}, {"title": "Enroll", "body": "Choose the plan that fits: fixed-term access, lifetime access or a subscription."}, {"title": "Learn", "body": "Work through video lessons, readings and resources at your own pace."}, {"title": "Practice", "body": "Complete quizzes and hands-on assignments with instructor feedback."}, {"title": "Complete", "body": "Finish the course requirements and earn a verifiable certificate."}, {"title": "Apply your skills", "body": "Put what you learned to work in your business or career."}]}'),
  ('home', 'formats', 6, '{"title": "Ways to learn", "items": [{"icon": "play-circle", "title": "Recorded training", "body": "Structured video lessons you can pause, rewatch and resume on any device."}, {"icon": "radio", "title": "Live workshops", "body": "Scheduled sessions on Zoom or Google Meet, with recordings when available."}, {"icon": "clipboard-check", "title": "Guided assignments", "body": "Practical tasks reviewed by instructors with written feedback."}, {"icon": "life-buoy", "title": "Student support", "body": "A help desk for account, billing and technical questions."}]}'),
  ('home', 'instructors', 7, '{"title": "Learn from practitioners", "subtitle": "Instructors are selected for hands-on experience in the subjects they teach."}'),
  ('home', 'testimonials', 8, '{"title": "What learners say", "subtitle": "Feedback from Foremint Academy students."}'),
  ('home', 'case_studies', 9, '{"title": "Learning in practice", "subtitle": "How students have applied what they learned."}'),
  ('home', 'pricing', 10, '{"title": "Plans that fit how you learn", "subtitle": "Buy a single course, save with a bundle or unlock everything with a membership."}'),
  ('home', 'faq', 11, '{"title": "Questions, answered"}'),
  ('home', 'final_cta', 12, '{"title": "Your next skill starts with one lesson", "body": "Create a free account, preview lessons and enroll when you are ready.", "primaryCta": {"label": "Create free account", "href": "/register"}, "secondaryCta": {"label": "Browse courses", "href": "/courses"}}'),
  ('about', 'intro', 1, '{"title": "Education for people who build", "body": "Foremint Academy teaches the practical skills behind online businesses and digital careers — from selling on Amazon and eBay to forming a company, building websites and apps, and reaching customers online.", "image": "/images/about/team-collaboration.jpg"}'),
  ('about', 'mission', 2, '{"title": "What we believe", "items": [{"title": "Skills over theory", "body": "Every course is organised around outcomes you can apply, with resources you can reuse."}, {"title": "Honest education", "body": "We teach methods, not promises. Results depend on your effort, market and circumstances."}, {"title": "Access for everyone", "body": "Flexible plans and mobile-friendly learning make it possible to study around real life."}]}'),
  ('about', 'approach', 3, '{"title": "How we teach", "body": "Courses combine short video lessons, written guides, downloadable templates, quizzes and reviewed assignments. Live workshops add space for questions, and course discussions keep learners connected.", "image": "/images/about/global-community.jpg"}')
) as s(page_slug, section_key, sort_order, content) on s.page_slug = p.slug
on conflict (page_id, section_key) do nothing;

insert into public.faqs (question, answer, category, sort_order, show_on_home) values
  ('How do I access a course after I buy it?', '<p>As soon as your payment is confirmed, the course appears under <strong>My Courses</strong> in your dashboard. Open it to start the first lesson; your progress is saved automatically.</p>', 'courses', 1, true),
  ('How long will I have access?', '<p>It depends on the plan you choose. Fixed-term plans (for example 30, 60 or 90 days) run from the day you enroll, lifetime plans never expire, and subscription plans stay active while your subscription is current. Your dashboard always shows your access end date.</p>', 'billing', 2, true),
  ('How are payments processed?', '<p>Payments are handled securely by Whop, our payment provider. The payment methods available to you are shown at checkout. We never see or store your full card details.</p>', 'billing', 3, true),
  ('Can I learn on my phone?', '<p>Yes. The platform works on phones, tablets and computers, and your progress syncs across devices.</p>', 'technical', 4, true),
  ('Do courses include a certificate?', '<p>Courses with certificates enabled issue a certificate once you meet the completion requirements listed on the course page. Every certificate has a unique number that anyone can verify online.</p>', 'certificates', 5, true),
  ('How do live classes work?', '<p>Live classes run on Zoom or Google Meet. Scheduled sessions appear in your dashboard in your local time with a join button, and recordings are added afterwards when available.</p>', 'live', 6, false),
  ('Can I ask my instructor questions?', '<p>Yes. You can post in your course discussions and send private messages to the instructors of courses you are enrolled in.</p>', 'courses', 7, false),
  ('How do I request a refund?', '<p>Read our <a href="/legal/refund">Refund Policy</a>, then open a support ticket from your dashboard with your order details. We review every request and reply by email.</p>', 'billing', 8, false)
on conflict do nothing;
