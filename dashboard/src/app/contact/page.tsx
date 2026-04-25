import { getLocale, t } from "@/lib/i18n";
import { FeedbackForm } from "@/components/feedback-form";

export default async function ContactPage() {
    const locale = await getLocale();

    return (
        <div className="space-y-4 max-w-2xl">
            {/* Contact info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                        {t(locale, "contact")}
                    </h3>
                </div>
                <div className="px-6 py-5 space-y-3">
                    <div>
                        <span className="text-sm font-medium text-gray-500">Email:</span>
                        <a
                            href="mailto:samphamviet@gmail.com"
                            className="ml-2 text-sm text-blue-600 hover:text-blue-500"
                        >
                            samphamviet@gmail.com
                        </a>
                    </div>
                </div>
            </div>

            {/* Feedback form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
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
