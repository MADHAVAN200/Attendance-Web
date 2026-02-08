import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Check, X, CreditCard, Users, Zap, Shield, HelpCircle } from 'lucide-react';

const Subscription = () => {
    const [userCount, setUserCount] = useState(50);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'
    const [animatePrice, setAnimatePrice] = useState(false);

    // Pricing Tiers (per user per month) - Monthly Billing
    const tiers = {
        basic: 49,
        professional: 99,
        enterprise: 149
    };

    // Discount for yearly billing
    const yearlyDiscount = 0.20;

    useEffect(() => {
        setAnimatePrice(true);
        const timer = setTimeout(() => setAnimatePrice(false), 300);
        return () => clearTimeout(timer);
    }, [userCount, billingCycle]);

    const calculatePrice = (basePrice) => {
        let price = basePrice;
        if (billingCycle === 'yearly') {
            price = price * (1 - yearlyDiscount);
        }
        return (price * userCount).toFixed(0);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    // Load Razorpay SDK
    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayment = async (planName, price) => {
        const res = await loadRazorpay();
        if (!res) {
            alert('Razorpay SDK failed to load. Are you online?');
            return;
        }

        // 1. Create Order
        // Ideally, use a real API call here. For demo, we assume the backend URL is set.
        const backendUrl = 'http://localhost:5002/api/payment';

        try {
            const orderResponse = await fetch(`${backendUrl}/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: price, // Price in INR
                    currency: 'INR',
                    receipt: `receipt_${Date.now()}`,
                    notes: { plan: planName, user_count: userCount }
                })
            });

            const orderData = await orderResponse.json();
            if (!orderData.id) {
                alert('Server error. Are you sure the backend is running with Razorpay keys?');
                return;
            }

            // 2. Open Checkout
            const options = {
                key: "rzp_test_S9b039rnV73YlF",  // <--- USER MUST REPLACE THIS temporarily or fetch from backend env if safe
                amount: orderData.amount,
                currency: orderData.currency,
                name: "MANO Attendance",
                description: `Subscription for ${planName} Plan`,
                order_id: orderData.id,
                handler: async function (response) {
                    // 3. Verify Payment
                    const verifyResponse = await fetch(`${backendUrl}/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    const verifyData = await verifyResponse.json();
                    if (verifyData.status === 'success') {
                        alert('Payment Successful! Subscription Active.');
                    } else {
                        alert('Payment Verification Failed!');
                    }
                },
                prefill: {
                    name: "Admin User", // Fetch from user context
                    email: "admin@mano.com",
                    contact: "9999999999"
                },
                theme: {
                    color: "#4F46E5"
                }
            };

            const paymentObject = new window.Razorpay(options);
            paymentObject.open();

        } catch (error) {
            console.error(error);
            alert('Error creating order');
        }
    };

    // Feature Comparison Data
    const features = [
        { name: 'Attendance Tracking', basic: true, pro: true, enterprise: true },
        { name: 'Mobile App Access', basic: true, pro: true, enterprise: true },
        { name: 'Attendance Export', basic: true, pro: true, enterprise: true },
        { name: 'Geo-Fencing', basic: false, pro: true, enterprise: true },
        { name: 'Holiday & Leave Mgmt', basic: false, pro: true, enterprise: true },
        { name: 'Shift Management', basic: false, pro: true, enterprise: true },
        { name: 'Daily Activity Report', basic: false, pro: false, enterprise: true },
        { name: 'Advanced Analytics', basic: false, pro: false, enterprise: true },
        { name: 'Dedicated Support', basic: false, pro: false, enterprise: true },
    ];

    return (
        <DashboardLayout title="Subscription">
            <div className="w-full space-y-10 pb-10">

                {/* Header Section */}
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <h1 className="text-4xl font-semibold text-slate-800 dark:text-white font-poppins">
                        Choose Your Plan
                    </h1>
                    <p className="text-lg text-slate-500 dark:text-slate-400 font-poppins">
                        Simple, transparent pricing that scales with your business. No hidden fees.
                    </p>

                    {/* Billing Toggle */}
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Monthly</span>
                        <button
                            onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${billingCycle === 'yearly' ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'}`}></div>
                        </button>
                        <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                            Yearly <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full ml-1 font-semibold">Save 20%</span>
                        </span>
                    </div>
                </div>

                {/* User Count Selector */}
                <div className="bg-white dark:bg-dark-card rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 w-full">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="w-full md:w-2/3 space-y-4">
                            <label className="text-lg font-medium text-slate-800 dark:text-white flex items-center gap-2">
                                <Users size={20} className="text-indigo-600" />
                                Number of Employees
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="1000"
                                value={userCount}
                                onChange={(e) => setUserCount(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>1</span>
                                <span>250</span>
                                <span>500</span>
                                <span>750</span>
                                <span>1000+</span>
                            </div>
                        </div>
                        <div className="w-full md:w-1/3 flex items-center justify-center md:justify-end">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center w-full max-w-[150px]">
                                <input
                                    type="number"
                                    value={userCount}
                                    onChange={(e) => setUserCount(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 bg-transparent text-center w-full focus:outline-none"
                                />
                                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">Users</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pricing Plans */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Basic Plan */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col hover:border-indigo-200 dark:hover:border-indigo-900 transition-all duration-300 relative group">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Basic</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Essential features for small teams.</p>
                        </div>
                        <div className="mb-8">
                            <div className={`text-4xl font-bold text-slate-900 dark:text-white font-poppins transition-all duration-300 ${animatePrice ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
                                {formatCurrency(calculatePrice(tiers.basic))}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                per month / billed {billingCycle}
                            </p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>Attendance Tracking</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>Mobile App Access</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>Attendance Export</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-400">
                                <X size={18} className="shrink-0 mt-0.5" />
                                <span>Daily Activity Report</span>
                            </li>
                        </ul>
                        <button
                            onClick={() => handlePayment('Basic', calculatePrice(tiers.basic))}
                            className="w-full py-3 rounded-xl border border-indigo-600 text-indigo-600 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                            Choose Basic
                        </button>
                    </div>

                    {/* Professional Plan */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-8 shadow-lg border-2 border-indigo-600 flex flex-col relative transform md:-translate-y-4">
                        <div className="absolute top-0 right-0 left-0 -mt-4 flex justify-center">
                            <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</span>
                        </div>
                        <div className="mb-6 mt-2">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                                Professional <Zap size={18} className="text-yellow-500 fill-yellow-500" />
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Everything you need to scale.</p>
                        </div>
                        <div className="mb-8">
                            <div className={`text-4xl font-bold text-slate-900 dark:text-white font-poppins transition-all duration-300 ${animatePrice ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
                                {formatCurrency(calculatePrice(tiers.professional))}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                per month / billed {billingCycle}
                            </p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>All Basic Features</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>Holiday & Leave Mgmt</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>Shift Management</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>Geo-Fencing</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-400">
                                <X size={18} className="shrink-0 mt-0.5" />
                                <span>Daily Activity Report</span>
                            </li>
                        </ul>
                        <button
                            onClick={() => handlePayment('Professional', calculatePrice(tiers.professional))}
                            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-[1.02]">
                            Choose Professional
                        </button>
                    </div>

                    {/* Enterprise Plan */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col hover:border-indigo-200 dark:hover:border-indigo-900 transition-all duration-300">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Enterprise</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Advanced control & support.</p>
                        </div>
                        <div className="mb-8">
                            <div className={`text-4xl font-bold text-slate-900 dark:text-white font-poppins transition-all duration-300 ${animatePrice ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
                                {formatCurrency(calculatePrice(tiers.enterprise))}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                per month / billed {billingCycle}
                            </p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>All Pro Features</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>Daily Activity Report</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>Dedicated Support</span>
                            </li>
                        </ul>
                        <button
                            onClick={() => handlePayment('Enterprise', calculatePrice(tiers.enterprise))}
                            className="w-full py-3 rounded-xl border border-indigo-600 text-indigo-600 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                            Choose Enterprise
                        </button>
                    </div>
                </div>

                {/* Feature Comparison Table */}
                <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Feature Comparison</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50">
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Feature</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Basic</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">Professional</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">Enterprise</th>
                                </tr>
                            </thead>
                            <tbody>
                                {features.map((feature, index) => (
                                    <tr key={index} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-200">{feature.name}</td>

                                        <td className="px-6 py-4 text-center">
                                            {feature.basic === true ? <Check size={18} className="text-green-500 mx-auto" /> :
                                                feature.basic === false ? <span className="text-slate-300">-</span> :
                                                    <span className="text-sm text-slate-600 dark:text-slate-400">{feature.basic}</span>}
                                        </td>

                                        <td className="px-6 py-4 text-center bg-indigo-50/10 dark:bg-indigo-900/10">
                                            {feature.pro === true ? <Check size={18} className="text-green-500 mx-auto" /> :
                                                feature.pro === false ? <span className="text-slate-300">-</span> :
                                                    <span className="text-sm font-medium text-slate-800 dark:text-white">{feature.pro}</span>}
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            {feature.enterprise === true ? <Check size={18} className="text-green-500 mx-auto" /> :
                                                feature.enterprise === false ? <span className="text-slate-300">-</span> :
                                                    <span className="text-sm text-slate-600 dark:text-slate-400">{feature.enterprise}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FAQ / Support Note */}
                <div className="text-center pt-8">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Need help choosing? <button className="text-indigo-600 font-medium hover:underline">Contact our sales team</button>
                    </p>
                </div>

            </div>
        </DashboardLayout>
    );
};

export default Subscription;
