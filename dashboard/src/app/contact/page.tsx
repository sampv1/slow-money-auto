import { getLocale, t } from "@/lib/i18n";
import { FeedbackForm } from "@/components/feedback-form";

export default async function ContactPage() {
    const locale = await getLocale();

    return (
        <div className="space-y-4 max-w-2xl">
            {/* Contact info */}
            <div className="bg-panel rounded-lg shadow-sm border border-line overflow-hidden">
                <div className="px-6 py-5 border-b border-line">
                    <h3 className="text-title leading-6 font-medium text-fg">
                        {t(locale, "contact")}
                    </h3>
                </div>
                <div className="px-6 py-5 space-y-3">
                    <div>
                        <span className="text-body-lg font-medium text-fg-muted">Email:</span>
                        <a
                            href="mailto:samphamviet@gmail.com"
                            className="ml-2 text-body-lg text-accent hover:text-blue-500"
                        >
                            samphamviet@gmail.com
                        </a>
                    </div>
                </div>
            </div>

            {/* Feedback form */}
            <div className="bg-panel rounded-lg shadow-sm border border-line overflow-hidden">
                <div className="px-6 py-5 border-b border-line">
                    <h3 className="text-title leading-6 font-medium text-fg">
                        {t(locale, "feedbackTitle")}
                    </h3>
                </div>
                <div className="px-6 py-5">
                    <FeedbackForm locale={locale} />
                </div>
            </div>
        </div>
    );
}
