import React from 'react';
import { FaCar, FaMusic, FaTv, FaWifi } from "react-icons/fa";
import { MdWifiCalling3 } from "react-icons/md";
import { TbAirConditioning } from "react-icons/tb";
import { Link } from "react-router-dom";

interface AmenitiesData {
    id: number,
    icon: React.ReactNode,
    title: string,
}

const Amenities = () => {

    const amenitiesData: AmenitiesData[] = [
        {
            id: 1,
            icon: <TbAirConditioning />,
            title: "Air conditioning",
        },
        {
            id: 2,
            icon: <MdWifiCalling3 />,
            title: "Service on call",
        },
        {
            id: 3,
            icon: <FaTv />,
            title: "Flat-screen TV",
        },
        {
            id: 4,
            icon: <FaWifi />,
            title: "Wi-Fi access",
        },
        {
            id: 5,
            icon: <FaCar />,
            title: "Parking area",
        },
        {
            id: 6,
            icon: <FaMusic />,
            title: "Sound system",
        },
    ]

    return (
        <section className="py-14 lg:py-28  bg-bg-primary">
            <div className="w-full h-fit  flex flex-col lg:flex-row justify-center items-center gap-5">
                {/* content  */}
                <div className="image w-full h-full flex-1 flex justify-center items-center gap-6">
                    <div className="flex flex-col gap-10">
                        <h3 className='text-2xl sm:text-3xl md:text-6xl font-medium'>The Essentials</h3>
                        <p className="text-base text-justify md:text-xl font-light">Experience the outstanding amenities that make your stay at Soumil Stay's truly unforgettable! Whether you're here to relax, explore, or enjoy the perfect mix of both, our hotels offer a carefully curated range of modern comforts and services, ensuring a seamless and delightful experience every time.</p>
                        <Link to="/contact" className="text-primary font-semibold text-sm md:text-2xl">Know More...</Link>
                    </div>
                </div>
                {/* Amenities  */}
                <div className="amenities w-full h-full flex-1 ">
                    <div className='h-full w-full px-3 sm:px-5 flex flex-col gap-4 sm:gap-6 md:gap-8 justify-center items-start'>
                        <div className='icons w-full grid grid-cols-3 gap-5 md:gap-16'>
                            {
                                amenitiesData?.map((item) => {
                                    return (
                                        <>
                                            <div key={item.id} className='flex flex-col gap-3'>
                                                <div className='flex flex-col justify-center items-center gap-2 sm:gap-3 '>
                                                    <span className="text-primary font-xs text-2xl lg:text-4xl">{item.icon}</span>
                                                    <div className="flex flex-col ">
                                                        <p className="font-semibold text-center text-xs lg:text-xl tracking-wide">{item.title}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )
                                })
                            }
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Amenities
