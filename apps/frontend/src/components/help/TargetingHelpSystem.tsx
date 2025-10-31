import React, { useState, useEffect } from 'react';
import {
    HelpCircle,
    Search,
    Book,
    MessageCircle,
    Video,
    ExternalLink,
    ChevronRight,
    ChevronDown,
    Target,
    Clock,
    AlertCircle,
    CheckCircle,
    X
} from 'lucide-react';

/**
 * Interactive Help System for Swap Targeting
 * 
 * Provides contextual help, tutorials, and troubleshooting
 * for the swap targeting feature.
 */

interface HelpArticle {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedReadTime: number;
    lastUpdated: string;
}

interface TutorialStep {
    id: string;
    title: string;
    description: string;
    action?: string;
    element?: string;
    screenshot?: string;
}

interface Tutorial {
    id: string;
    title: string;
    description: string;
    duration: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    steps: TutorialStep[];
}

interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category: string;
    helpful: number;
    notHelpful: number;
}

interface TargetingHelpSystemProps {
    isOpen: boolean;
    onClose: () => void;
    context?: 'browse' | 'dashboard' | 'targeting' | 'auction';
    currentSwapId?: string;
}

const TargetingHelpSystem: React.FC<TargetingHelpSystemProps> = ({
    isOpen,
    onClose,
    context = 'browse',
    currentSwapId
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'tutorials' | 'faq' | 'troubleshooting' | 'contact'>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
    const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);

    // Sample data - in real implementation, this would come from API
    const helpArticles: HelpArticle[] = [
        {
            id: 'targeting-basics',
            title: 'Swap Targeting Basics',
            content: 'Learn the fundamentals of targeting other users\' swaps...',
            category: 'Getting Started',
            tags: ['targeting', 'basics', 'beginner'],
            difficulty: 'beginner',
            estimatedReadTime: 3,
            lastUpdated: '2025-01-15'
        },
        {
            id: 'auction-vs-one-for-one',
            title: 'Auction Mode vs One-for-One',
            content: 'Understand the differences between auction and one-for-one modes...',
            category: 'Swap Modes',
            tags: ['auction', 'one-for-one', 'modes'],
            difficulty: 'intermediate',
            estimatedReadTime: 5,
            lastUpdated: '2025-01-15'
        },
        {
            id: 'troubleshooting-targeting',
            title: 'Troubleshooting Targeting Issues',
            content: 'Common targeting problems and their solutions...',
            category: 'Troubleshooting',
            tags: ['troubleshooting', 'errors', 'problems'],
            difficulty: 'intermediate',
            estimatedReadTime: 7,
            lastUpdated: '2025-01-15'
        }
    ];

    const tutorials: Tutorial[] = [
        {
            id: 'first-targeting',
            title: 'Your First Targeting Experience',
            description: 'Step-by-step guide to targeting your first swap',
            duration: 5,
            difficulty: 'beginner',
            steps: [
                {
                    id: 'step-1',
                    title: 'Navigate to Browse',
                    description: 'Go to the Browse Swaps page to find available swaps',
                    action: 'Click on "Browse Swaps" in the navigation menu',
                    element: '[data-testid="browse-nav-link"]'
                },
                {
                    id: 'step-2',
                    title: 'Find a Compatible Swap',
                    description: 'Look for swaps that match your dates and preferences',
                    action: 'Use filters to narrow down your search',
                    element: '[data-testid="swap-filters"]'
                },
                {
                    id: 'step-3',
                    title: 'Target the Swap',
                    description: 'Click the "Target My Swap" button on a swap you like',
                    action: 'Click "Target My Swap" button',
                    element: '[data-testid="target-my-swap-btn"]'
                },
                {
                    id: 'step-4',
                    title: 'Confirm Your Targeting',
                    description: 'Review the details and confirm your targeting request',
                    action: 'Click "Confirm Targeting" in the modal',
                    element: '[data-testid="confirm-targeting-btn"]'
                },
                {
                    id: 'step-5',
                    title: 'Monitor Your Proposal',
                    description: 'Check your dashboard for proposal status updates',
                    action: 'Go to your dashboard to see targeting status',
                    element: '[data-testid="dashboard-nav-link"]'
                }
            ]
        },
        {
            id: 'auction-targeting',
            title: 'Targeting Auction Mode Swaps',
            description: 'Learn how to effectively target swaps in auction mode',
            duration: 8,
            difficulty: 'intermediate',
            steps: [
                {
                    id: 'auction-step-1',
                    title: 'Identify Auction Swaps',
                    description: 'Look for the auction timer and proposal count',
                    action: 'Find swaps with countdown timers',
                    element: '[data-testid="auction-timer"]'
                },
                {
                    id: 'auction-step-2',
                    title: 'Check Competition',
                    description: 'See how many other proposals have been submitted',
                    action: 'Look at the proposal count indicator',
                    element: '[data-testid="proposal-count"]'
                },
                {
                    id: 'auction-step-3',
                    title: 'Submit Your Proposal',
                    description: 'Target the auction swap with a compelling message',
                    action: 'Click "Target My Swap" and add a message',
                    element: '[data-testid="targeting-message"]'
                },
                {
                    id: 'auction-step-4',
                    title: 'Wait for Auction End',
                    description: 'Monitor the auction until it ends',
                    action: 'Check back periodically or enable notifications',
                    element: '[data-testid="auction-status"]'
                }
            ]
        }
    ];

    const faqItems: FAQItem[] = [
        {
            id: 'faq-1',
            question: 'Why can\'t I see the "Target My Swap" button?',
            answer: 'The "Target My Swap" button appears only when you have an active swap and are viewing someone else\'s available swap. Make sure you have created and published a swap first.',
            category: 'Targeting Basics',
            helpful: 45,
            notHelpful: 3
        },
        {
            id: 'faq-2',
            question: 'What\'s the difference between auction mode and one-for-one?',
            answer: 'One-for-one mode accepts only one proposal at a time (first-come, first-served), while auction mode allows multiple proposals and the owner chooses the best one within a time limit.',
            category: 'Swap Modes',
            helpful: 67,
            notHelpful: 2
        },
        {
            id: 'faq-3',
            question: 'Can I change my target after targeting a swap?',
            answer: 'Yes, you can retarget your swap to a different one. This will cancel your current proposal and create a new one with the new target.',
            category: 'Targeting Management',
            helpful: 34,
            notHelpful: 1
        },
        {
            id: 'faq-4',
            question: 'Why does it say "Proposal Pending - Cannot Target"?',
            answer: 'This appears on one-for-one swaps that already have a pending proposal. You\'ll need to wait for that proposal to be resolved or look for auction mode swaps instead.',
            category: 'Troubleshooting',
            helpful: 56,
            notHelpful: 4
        }
    ];

    // Context-specific help content
    const getContextualHelp = () => {
        switch (context) {
            case 'browse':
                return {
                    title: 'Browse & Target Swaps',
                    description: 'Find and target swaps that match your preferences',
                    quickActions: [
                        { label: 'How to target a swap', action: () => setActiveTutorial(tutorials[0]) },
                        { label: 'Understanding swap modes', action: () => setActiveTab('faq') },
                        { label: 'Targeting troubleshooting', action: () => setActiveTab('troubleshooting') }
                    ]
                };
            case 'dashboard':
                return {
                    title: 'Manage Your Targeting',
                    description: 'Monitor and manage your current targeting activities',
                    quickActions: [
                        { label: 'How to retarget', action: () => setActiveTab('tutorials') },
                        { label: 'Understanding proposal status', action: () => setActiveTab('faq') },
                        { label: 'Targeting history', action: () => setActiveTab('overview') }
                    ]
                };
            case 'auction':
                return {
                    title: 'Auction Mode Targeting',
                    description: 'Learn how to effectively compete in auction mode swaps',
                    quickActions: [
                        { label: 'Auction targeting tutorial', action: () => setActiveTutorial(tutorials[1]) },
                        { label: 'Auction strategies', action: () => setActiveTab('overview') },
                        { label: 'Auction troubleshooting', action: () => setActiveTab('troubleshooting') }
                    ]
                };
            default:
                return {
                    title: 'Swap Targeting Help',
                    description: 'Everything you need to know about targeting swaps',
                    quickActions: [
                        { label: 'Getting started', action: () => setActiveTutorial(tutorials[0]) },
                        { label: 'Common questions', action: () => setActiveTab('faq') },
                        { label: 'Contact support', action: () => setActiveTab('contact') }
                    ]
                };
        }
    };

    const contextualHelp = getContextualHelp();

    // Search functionality
    useEffect(() => {
        if (searchQuery.trim()) {
            const results = helpArticles.filter(article =>
                article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const renderOverview = () => (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <Target className="w-6 h-6 text-blue-600 mt-1" />
                    <div>
                        <h3 className="font-semibold text-blue-900">{contextualHelp.title}</h3>
                        <p className="text-blue-700 mt-1">{contextualHelp.description}</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-1 gap-2">
                    {contextualHelp.quickActions.map((action, index) => (
                        <button
                            key={index}
                            onClick={action.action}
                            className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <span className="text-gray-700">{action.label}</span>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-gray-900 mb-3">Popular Articles</h3>
                <div className="space-y-2">
                    {helpArticles.slice(0, 3).map(article => (
                        <div key={article.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">{article.title}</h4>
                                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                                        <span className="flex items-center">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {article.estimatedReadTime} min read
                                        </span>
                                        <span className="capitalize">{article.difficulty}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderTutorials = () => (
        <div className="space-y-6">
            {activeTutorial ? (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setActiveTutorial(null)}
                            className="flex items-center text-blue-600 hover:text-blue-700"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                            Back to tutorials
                        </button>
                        <span className="text-sm text-gray-500">
                            Step {currentStep + 1} of {activeTutorial.steps.length}
                        </span>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-900">
                                    {activeTutorial.steps[currentStep].title}
                                </h3>
                                <div className="flex space-x-2">
                                    {activeTutorial.steps.map((_, index) => (
                                        <div
                                            key={index}
                                            className={`w-2 h-2 rounded-full ${index <= currentStep ? 'bg-blue-600' : 'bg-gray-300'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <p className="text-gray-600 mb-4">
                                {activeTutorial.steps[currentStep].description}
                            </p>
                            {activeTutorial.steps[currentStep].action && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-blue-800 font-medium">
                                        Action: {activeTutorial.steps[currentStep].action}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between">
                            <button
                                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                                disabled={currentStep === 0}
                                className="px-4 py-2 text-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => {
                                    if (currentStep < activeTutorial.steps.length - 1) {
                                        setCurrentStep(currentStep + 1);
                                    } else {
                                        setActiveTutorial(null);
                                        setCurrentStep(0);
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                {currentStep < activeTutorial.steps.length - 1 ? 'Next' : 'Complete'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {tutorials.map(tutorial => (
                        <div
                            key={tutorial.id}
                            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                            onClick={() => setActiveTutorial(tutorial)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">{tutorial.title}</h3>
                                    <p className="text-gray-600 mt-1">{tutorial.description}</p>
                                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                        <span className="flex items-center">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {tutorial.duration} minutes
                                        </span>
                                        <span className="capitalize">{tutorial.difficulty}</span>
                                        <span>{tutorial.steps.length} steps</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Video className="w-5 h-5 text-gray-400" />
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderFAQ = () => (
        <div className="space-y-4">
            {faqItems.map(faq => (
                <div key={faq.id} className="border border-gray-200 rounded-lg">
                    <button
                        onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                    >
                        <span className="font-medium text-gray-900">{faq.question}</span>
                        {expandedFAQ === faq.id ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                    </button>
                    {expandedFAQ === faq.id && (
                        <div className="px-4 pb-4">
                            <p className="text-gray-600 mb-3">{faq.answer}</p>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Was this helpful?</span>
                                <div className="flex items-center space-x-4">
                                    <button className="flex items-center space-x-1 text-sm text-green-600 hover:text-green-700">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Yes ({faq.helpful})</span>
                                    </button>
                                    <button className="flex items-center space-x-1 text-sm text-red-600 hover:text-red-700">
                                        <X className="w-4 h-4" />
                                        <span>No ({faq.notHelpful})</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    const renderTroubleshooting = () => (
        <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertCircle className="w-6 h-6 text-yellow-600 mt-1" />
                    <div>
                        <h3 className="font-semibold text-yellow-900">Quick Diagnosis</h3>
                        <p className="text-yellow-700 mt-1">
                            Use our troubleshooting guide to quickly identify and resolve common issues.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Can't see "Target My Swap" button?</h3>
                    <ul className="space-y-2 text-gray-600">
                        <li>• Make sure you have an active swap</li>
                        <li>• Verify you're not viewing your own swap</li>
                        <li>• Check if the swap is available for targeting</li>
                        <li>• Ensure you're logged in</li>
                    </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Button is disabled/grayed out?</h3>
                    <ul className="space-y-2 text-gray-600">
                        <li>• One-for-one swap may have a pending proposal</li>
                        <li>• Auction may have ended</li>
                        <li>• Circular targeting detected</li>
                        <li>• Swap may be temporarily unavailable</li>
                    </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Targeting fails with error?</h3>
                    <ul className="space-y-2 text-gray-600">
                        <li>• Check your internet connection</li>
                        <li>• Try refreshing the page</li>
                        <li>• Clear browser cache</li>
                        <li>• Contact support if issue persists</li>
                    </ul>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Still need help?</h3>
                <p className="text-blue-700 mb-3">
                    If you're still experiencing issues, our support team is here to help.
                </p>
                <button
                    onClick={() => setActiveTab('contact')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    Contact Support
                </button>
            </div>
        </div>
    );

    const renderContact = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                        <MessageCircle className="w-6 h-6 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">Live Chat</h3>
                    </div>
                    <p className="text-gray-600 mb-3">
                        Get instant help from our support team during business hours.
                    </p>
                    <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                        Start Chat
                    </button>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                        <Book className="w-6 h-6 text-green-600" />
                        <h3 className="font-semibold text-gray-900">Email Support</h3>
                    </div>
                    <p className="text-gray-600 mb-3">
                        Send us a detailed message and we'll respond within 24 hours.
                    </p>
                    <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                        Send Email
                    </button>
                </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Additional Resources</h3>
                <div className="space-y-2">
                    <a
                        href="/help/targeting-guide"
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                        <span className="text-gray-700">Complete Targeting Guide</span>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                    <a
                        href="/help/video-tutorials"
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                        <span className="text-gray-700">Video Tutorials</span>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                    <a
                        href="/community/forum"
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                        <span className="text-gray-700">Community Forum</span>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                </div>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <HelpCircle className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Swap Targeting Help</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-6 border-b border-gray-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search help articles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                            <p className="text-sm text-gray-600 mb-2">Search Results:</p>
                            {searchResults.map(article => (
                                <div key={article.id} className="p-2 hover:bg-white rounded cursor-pointer">
                                    <h4 className="font-medium text-gray-900">{article.title}</h4>
                                    <p className="text-sm text-gray-600">{article.category}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    {[
                        { id: 'overview', label: 'Overview', icon: Target },
                        { id: 'tutorials', label: 'Tutorials', icon: Video },
                        { id: 'faq', label: 'FAQ', icon: HelpCircle },
                        { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle },
                        { id: 'contact', label: 'Contact', icon: MessageCircle }
                    ].map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'tutorials' && renderTutorials()}
                    {activeTab === 'faq' && renderFAQ()}
                    {activeTab === 'troubleshooting' && renderTroubleshooting()}
                    {activeTab === 'contact' && renderContact()}
                </div>
            </div>
        </div>
    );
};

export default TargetingHelpSystem;