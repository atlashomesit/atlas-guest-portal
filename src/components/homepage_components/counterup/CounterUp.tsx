import AnimatedCounter from '../../../AnimatedCounter'
import { TrendingUp, Hotel, Globe, Map, Users, Building } from 'lucide-react'

const CounterUp = () => {
  const stats = [
    {
      icon: <Hotel size={24} />,
      count: 3500,
      label: 'Hotels',
      description: 'Premium properties'
    },
    {
      icon: <Building size={24} />,
      count: 150,
      label: 'OTAs',
      description: 'Online travel agencies'
    },
    {
      icon: <Users size={24} />,
      count: 300,
      label: 'Travel Agent Partners',
      description: 'Worldwide network'
    },
    {
      icon: <TrendingUp size={24} />,
      count: 75000,
      label: 'Rooms',
      description: 'Quality accommodations'
    },
    {
      icon: <Map size={24} />,
      count: 250,
      label: 'Locations',
      description: 'Across the globe'
    },
    {
      icon: <Globe size={24} />,
      count: 2,
      label: 'Countries',
      description: 'International presence'
    }
  ]

  return (
    <section className="py-12 px-4 md:px-20 bg-bgsecondary">
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center text-primary_desClr">Our Global Presence</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-5">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="flex flex-col items-center justify-center"
            >
              <div className="text-primary_desClr mb-2">
                {stat.icon}
              </div>
              
              <div className="text-primary_desClr flex items-center text-2xl sm:text-3xl lg:text-5xl font-semibold">
                <AnimatedCounter from={0} to={stat.count} />
                {stat.count !== 2 && <span>+</span>}
              </div>
              
              <p className="text-primary_desClr text-center font-normal text-lg md:text-xl mt-1">
                {stat.label}
              </p>
              
              <p className="text-primary_desClr text-center text-sm opacity-75 mt-1">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CounterUp