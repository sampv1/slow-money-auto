import { getLocale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export default async function ContactPage() {
    const locale = await getLocale();

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {t(locale, "contact")}
                </h3>
            </div>
            <div className="px-6 py-5">
                <div className="space-y-4">
                    <div>
                        <span className="text-sm font-medium text-gray-500">Email:</span>
                        <span className="ml-2 text-sm text-gray-900">
                            <a href="mailto:samphamviet@gmail.com" className="text-blue-600 hover:text-blue-500">
                                samphamviet@gmail.com
                            </a>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
